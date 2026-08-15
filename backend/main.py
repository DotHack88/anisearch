"""
AniSearch — Backend API (FastAPI)
"""

import os
import sys
import uuid
import json
import asyncio
import logging
import warnings
import re
from pathlib import Path
from typing import Any
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load environment variables from backend/ and root directories
env_dir = Path(__file__).resolve().parent
load_dotenv(env_dir / ".env")
load_dotenv(env_dir.parent / ".env")

from fastapi import FastAPI, HTTPException, Query, Header, Request, Depends, Cookie, Response, BackgroundTasks, UploadFile, File
from fastapi.staticfiles import StaticFiles

# Add project root to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.scraper import AnimeWorldScraper  # noqa: E402
from backend.manga_scraper import MangaWorldScraper  # noqa: E402
from backend.database import AnimeDatabase, MangaDatabase  # noqa: E402
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # noqa: E402

# Redis for caching frequent searches (optional — works without it)
try:
    import redis as _redis_mod
    _r = _redis_mod.Redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        socket_connect_timeout=2,
    )
    _r.ping()  # verify connection
    redis_client = _r
except Exception:
    redis_client = None  # Redis not available or unreachable — no caching

# Helper functions for cache
def cache_get(key: str) -> Any:
    if redis_client is None:
        return None
    try:
        val = redis_client.get(key)
        if val is None:
            return None
        if isinstance(val, bytes):
            return val.decode("utf-8")
        return str(val)
    except Exception:
        return None

def cache_set(key: str, value: Any, ex: int = 300) -> None:
    if redis_client:
        try:
            redis_client.set(key, value, ex=ex)
        except Exception:
            pass

# Rate limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _has_slowapi = True
except ImportError:
    _has_slowapi = False
    Limiter = None  # type: ignore
    _rate_limit_exceeded_handler = None  # type: ignore
    get_remote_address = None  # type: ignore
    RateLimitExceeded = Exception  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration from environment ---
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_env_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
# Always include production origins — merge env var origins with hardcoded defaults
_default_origins = [
    "https://anisearch-eta.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
]
allowed_origins = list(dict.fromkeys(_env_origins + _default_origins))  # deduplicated, env origins first

db = AnimeDatabase()
scraper = AnimeWorldScraper()
manga_db = MangaDatabase()
manga_scraper = MangaWorldScraper()
scheduler = AsyncIOScheduler()

async def scheduled_update():
    """Job schedulato: cerca nuovi episodi con gestione errori e retry logging."""
    try:
        logger.info("Avvio job schedulato per ricerca nuovi episodi...")
        await asyncio.to_thread(scraper.scrape_latest_updates, db, loop=asyncio.get_running_loop())
        logger.info("Job schedulato completato con successo.")
    except Exception as e:
        logger.error(
            f"Errore nel job schedulato di aggiornamento episodi: {e}. "
            "Il job verrà ritentato al prossimo intervallo (15 min).",
            exc_info=True,
        )

async def daily_catalog_sync():
    """Job schedulato: scansiona l'intero catalogo (ogni 24h) per trovare nuovi anime sfuggiti agli aggiornamenti recenti."""
    try:
        logger.info("Avvio sincronizzazione completa del catalogo in background (job 24h)...")
        await asyncio.to_thread(scraper.build_full_index, db, loop=asyncio.get_running_loop())
        logger.info("Sincronizzazione completa del catalogo terminata con successo.")
    except Exception as e:
        logger.error(
            f"Errore durante la sincronizzazione completa del catalogo: {e}", 
            exc_info=True
        )

# Global sync status tracker (definito qui per essere visibile a lifespan e all'endpoint)
_manga_sync_status: dict = {"running": False, "scraped": 0, "total": 0, "saved": 0, "error": None}

async def _run_manga_sync():
    """Coroutine riutilizzabile: scrapa l'archivio MangaWorld e salva nel DB."""
    global _manga_sync_status
    if _manga_sync_status["running"]:
        return
    _manga_sync_status = {"running": True, "scraped": 0, "total": 0, "saved": 0, "error": None}
    try:
        logger.info("Avvio sincronizzazione archivio MangaWorld...")

        def progress_cb(done: int, total: int):
            _manga_sync_status["scraped"] = done
            _manga_sync_status["total"] = total

        manga_list = await asyncio.to_thread(manga_scraper.scrape_full_archive, progress_cb)
        logger.info(f"Archivio scraping completato: {len(manga_list)} manga. Salvataggio nel DB...")
        chunk_size = 200
        saved = 0
        for i in range(0, len(manga_list), chunk_size):
            chunk = manga_list[i:i + chunk_size]
            await manga_db.add_batch(chunk, mode="ignore")
            saved += len(chunk)
            _manga_sync_status["saved"] = saved
        logger.info(f"Sincronizzazione archivio completata: {saved} manga salvati nel DB.")
    except Exception as e:
        logger.error(f"Errore sincronizzazione archivio manga: {e}")
        _manga_sync_status["error"] = str(e)
    finally:
        _manga_sync_status["running"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eseguiamo lo scraping massivo solo se il DB è vuoto
    if await db.count() == 0:
        logger.info("Database vuoto — Avvio scraping iniziale completo in background...")
        async def run_initial_scrape():
            try:
                await asyncio.to_thread(scraper.build_full_index, db, loop=asyncio.get_running_loop())
                logger.info(f"Database pronto: {await db.count()} anime salvati.")
            except Exception as e:
                logger.error(f"Errore popolamento db in background: {e}")
        
        asyncio.create_task(run_initial_scrape())
    else:
        logger.info(f"Avvio rapido — Database già popolato con {await db.count()} anime.")

    # Auto-sync archivio manga se il DB manga è vuoto
    manga_count = await manga_db.count()
    if manga_count == 0:
        logger.info("Database manga vuoto — Avvio importazione archivio MangaWorld in background...")
        asyncio.create_task(_run_manga_sync())
    else:
        logger.info(f"Avvio rapido manga — Database già popolato con {manga_count} manga.")
        
    if not os.getenv("ADMIN_TOKEN"):
        warnings.warn(
            "ADMIN_TOKEN non è impostato. "
            "L'endpoint /cache/refresh non funzionerà.",
            RuntimeWarning
        )
        
    # Avvio Scheduler (un solo worker — UVICORN_WORKERS=1 nel Dockerfile)
    scheduler.add_job(
        scheduled_update,
        'interval',
        minutes=15,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        daily_catalog_sync,
        'interval',
        hours=24,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=600,
    )
    scheduler.start()
    logger.info("Scheduler avviato: controllerà nuovi episodi ogni 15 minuti e farà un sync completo ogni 24 ore.")
    
    yield
    
    # Spegnimento Scheduler (solo se avviato in questo processo)
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler fermato.")

def verify_admin_token(x_admin_token: str = Header(...)):
    """Verifica il token admin nell'header X-Admin-Token."""
    admin_token = os.getenv("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(
            status_code=500,
            detail="ADMIN_TOKEN non configurato sul server."
        )
    if x_admin_token != admin_token:
        raise HTTPException(
            status_code=401,
            detail="Token non valido."
        )


app = FastAPI(title="AniSearch API", version="2.1.0", lifespan=lifespan)

AVATARS_DIR = env_dir.parent / "backend" / "data" / "avatars"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=str(AVATARS_DIR)), name="avatars")

# --- Rate limiting setup ---
if _has_slowapi:
    assert get_remote_address is not None
    assert Limiter is not None
    assert _rate_limit_exceeded_handler is not None
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore
else:
    limiter = None

from fastapi.middleware.cors import CORSMiddleware

# CORS: allow_origins=["*"] — funziona con qualsiasi dominio frontend.
# Le sessioni usano X-Session-Id header (non cookie), quindi
# allow_credentials=False è corretto e sicuro.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra il router TMDB (modulo separato — evita cache bytecode su Windows)
from backend.tmdb import router as tmdb_router  # noqa: E402
app.include_router(tmdb_router)

from backend.auth import router as auth_router
app.include_router(auth_router)


# --- Auth helper rimosso in favore di verify_admin_token ---


@app.get("/")
def root():
    """API root — welcome message and available endpoints."""
    return {
        "name": "AniSearch API",
        "version": "2.1.0",
        "endpoints": [
            "GET  /status",
            "GET  /search?q=...",
            "GET  /catalog",
            "GET  /filters",
            "GET  /new",
            "GET  /latest-episodes",
            "GET  /anime/{anime_id}",
            "GET  /episode/{episode_id}/video",
            "GET  /watch/{anime_id}",
            "POST /watch/{anime_id}?episode_id=...",
            "DELETE /watch/{anime_id}?episode_id=...",
        ],
    }


@app.get("/status")
async def status():
    anime_count = await db.count()
    episode_count = await db.count_episodes()
    from backend.database import engine
    return {
        "status": "online",
        "cached_anime": anime_count,
        "total_episodes": episode_count,
        "cache_ready": anime_count > 0,
        "database_type": engine.url.drivername,
    }


if _has_slowapi and limiter:
    @app.get("/search")
    @limiter.limit("30/minute")
    async def search(request: Request, q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)):
        if not q.strip():
            raise HTTPException(400, "Query vuota")
        cache_key = f"search:{q}:{limit}"
        cached = cache_get(cache_key)
        if cached:
            return json.loads(cached)
        results = await db.search_exact_or_fuzzy_fallback(q.strip(), limit=limit)
        response = {"query": q, "count": len(results), "results": results}
        cache_set(cache_key, json.dumps(response), ex=300)
        return response
else:
    @app.get("/search")
    async def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)):
        if not q.strip():
            raise HTTPException(400, "Query vuota")
        cache_key = f"search:{q}:{limit}"
        cached = cache_get(cache_key)
        if cached:
            return json.loads(cached)
        results = await db.search_exact_or_fuzzy_fallback(q.strip(), limit=limit)
        response = {"query": q, "count": len(results), "results": results}
        cache_set(cache_key, json.dumps(response), ex=300)
        return response



@app.get("/new")
async def new_updates(limit: int = Query(20, ge=1, le=100)):
    """Return the most recent episodes added by the scheduler."""
    episodes = await db.get_recent_episodes(limit)
    return {"limit": limit, "episodes": episodes}

@app.get("/latest-episodes")
async def latest_episodes():
    """Return the latest episodes directly scraped from the homepage."""
    cache_key = "latest_episodes"
    cached = cache_get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Run scraper in thread
    results = await asyncio.to_thread(scraper.get_latest_episodes)
    if "error" not in results:
        cache_set(cache_key, json.dumps(results), ex=300) # Cache for 5 min
    return results


def get_or_create_session(
    request: Request,
    response: Response,
    anisearch_session: str | None = Cookie(default=None)
) -> str:
    """
    Get or create a session ID.
    Validates format as UUID v4 to prevent spoofing.
    """
    from uuid import UUID

    def validate_session_id(session_id: str) -> bool:
        """Validate that session_id is a safe format (alphanumeric and dashes, 5-64 chars)."""
        if not session_id:
            return False
        return bool(re.match(r'^[a-zA-Z0-9\-]{5,64}$', session_id))

    # Priorità: header X-Session-Id (usato dal frontend cross-site) > cookie
    header_session = request.headers.get("X-Session-Id")
    if header_session:
        if validate_session_id(header_session):
            return header_session
        else:
            logger.warning(f"Invalid X-Session-Id format: {header_session}")
            raise HTTPException(400, "Invalid session ID format")

    if anisearch_session and validate_session_id(anisearch_session):
        return anisearch_session

    if not anisearch_session:
        anisearch_session = str(uuid.uuid4())
        response.set_cookie(
            key="anisearch_session",
            value=anisearch_session,
            max_age=60 * 60 * 24 * 365,
            httponly=True,
            samesite="lax"
        )
    return anisearch_session

@app.get("/watch")
async def get_all_watch(
    session_id: str = Depends(get_or_create_session),
    limit: int = Query(12, ge=1, le=50)
):
    """Get recent watch progress items for all anime."""
    return await db.get_recent_watch_progress(session_id, limit)

@app.get("/watch/{anime_id}")
async def get_watch(anime_id: str, session_id: str = Depends(get_or_create_session)):
    """Get the last watched episode for an anime."""
    progress = await db.get_watch_progress(session_id, anime_id)
    return progress or {"message": "No progress found"}

@app.delete("/watch/{anime_id}")
async def delete_watch(anime_id: str, episode_id: str = Query(...), session_id: str = Depends(get_or_create_session)):
    """Delete watch progress for given anime (ignore episode_id)."""
    await db.delete_watch_progress(session_id, anime_id)
    return {"status": "deleted", "anime_id": anime_id}

@app.post("/watch/{anime_id}")
async def save_watch(anime_id: str, episode_id: str = Query(...), session_id: str = Depends(get_or_create_session)):
    """Save watch progress for a given anime and episode."""
    await db.save_watch_progress(session_id, anime_id, episode_id)
    return {"status": "saved", "anime_id": anime_id, "episode_id": episode_id}

@app.get("/favorites")
async def get_favorites(session_id: str = Depends(get_or_create_session)):
    return await db.get_favorites(session_id)

@app.post("/favorites/{anime_id}")
async def add_favorite(anime_id: str, session_id: str = Depends(get_or_create_session)):
    await db.save_favorite(session_id, anime_id)
    return {"status": "saved"}

@app.delete("/favorites/{anime_id}")
async def remove_favorite(anime_id: str, session_id: str = Depends(get_or_create_session)):
    await db.remove_favorite(session_id, anime_id)
    return {"status": "deleted"}

@app.get("/watchlist")
async def get_watchlist(status: str = Query(""), session_id: str = Depends(get_or_create_session)):
    return await db.get_watchlist(session_id, status_filter=status or None)

@app.get("/watchlist/stats")
async def get_watchlist_stats(session_id: str = Depends(get_or_create_session)):
    return await db.get_watchlist_stats(session_id)

@app.post("/watchlist/{anime_id}")
async def add_to_watchlist(
    anime_id: str,
    status: str = Query("da_guardare"),
    episodes_watched: int = Query(None),
    episodes_total: int = Query(None),
    notes: str = Query(None),
    session_id: str = Depends(get_or_create_session)
):
    await db.save_watchlist(session_id, anime_id, status, episodes_watched, episodes_total, notes)
    return {"status": "saved"}

@app.put("/watchlist/{anime_id}")
async def update_watchlist(
    anime_id: str,
    status: str = Query(...),
    episodes_watched: int = Query(None),
    episodes_total: int = Query(None),
    notes: str = Query(None),
    session_id: str = Depends(get_or_create_session)
):
    await db.save_watchlist(session_id, anime_id, status, episodes_watched, episodes_total, notes)
    return {"status": "updated"}

@app.delete("/watchlist/{anime_id}")
async def remove_from_watchlist(anime_id: str, session_id: str = Depends(get_or_create_session)):
    await db.remove_watchlist(session_id, anime_id)
    return {"status": "deleted"}


# Extend anime_detail to store episodes after fetching
@app.get("/anime/{anime_id}")
async def anime_detail(anime_id: str):
    base = await db.get_by_id(anime_id)
    if not base:
        # Check latest-episodes cache or fetch directly as fallback
        cache_key = "latest_episodes"
        cached = cache_get(cache_key)
        if cached:
            latest_data = json.loads(cached)
        else:
            latest_data = await asyncio.to_thread(scraper.get_latest_episodes)
            if "error" not in latest_data:
                cache_set(cache_key, json.dumps(latest_data), ex=300)

        if isinstance(latest_data, dict) and "error" not in latest_data:
            for items in latest_data.values():
                if isinstance(items, list):
                    for item in items:
                        if item.get("id") == anime_id:
                            base = {
                                "id": anime_id,
                                "url": item.get("url", ""),
                                "title": item.get("title", ""),
                                "image": item.get("image", ""),
                                "type": "",
                                "genres": [],
                                "status": "",
                                "year": "",
                                "rating": "",
                            }
                            # Save this new base to DB to speed up future requests
                            await db.add_batch([base])
                            break
                if base:
                    break

    if not base:
        raise HTTPException(404, "Anime non trovato")
    try:
        detail = await asyncio.to_thread(scraper.get_anime_detail, str(base["url"]))
        # Store episodes in DB if present
        episodes = detail.get("episodes", [])
        for ep in episodes:
            ep["anime_id"] = anime_id
        if episodes:
            await db.add_episodes(episodes)
        return {**base, **detail}
    except Exception as e:
        logger.error(f"Errore dettaglio {anime_id}: {e}")
        return {**base, "episodes": [], "error": "Impossibile caricare gli episodi"}



@app.get("/episode/{episode_id}/video")
@limiter.limit("60/minute") if limiter else lambda f: f
async def episode_video(request: Request, episode_id: str):
    """Get the direct video stream URL for an episode."""
    try:
        # Enforce an absolute timeout of 20 seconds so we never hang indefinitely and cause 502s!
        result = await asyncio.wait_for(
            asyncio.to_thread(scraper.get_episode_video_url, episode_id),
            timeout=20.0
        )
        if result.get("video_url"):
            return result
        raise HTTPException(404, result.get("error", "Video non trovato"))
    except asyncio.TimeoutError:
        logger.error(f"Timeout video {episode_id} (oltre 20s)")
        raise HTTPException(504, "Il server di origine ha impiegato troppo tempo a rispondere (Timeout)")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore video {episode_id}: {e}")
        raise HTTPException(500, "Errore nel recupero del video")


@app.get("/episode/{episode_id}/download")
async def download_episode(episode_id: str):
    """Proxy-stream the video file for offline download with Content-Length."""
    from starlette.responses import StreamingResponse
    import requests as dl_requests

    result = await asyncio.to_thread(scraper.get_episode_video_url, episode_id)
    video_url = result.get("video_url")
    if not video_url:
        raise HTTPException(404, "Video non trovato")

    try:
        head = dl_requests.head(video_url, timeout=10, allow_redirects=True)
        content_length = head.headers.get("Content-Length")
    except Exception:
        content_length = None

    def stream():
        with dl_requests.get(video_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk

    headers = {
        "Content-Type": "video/mp4",
        "Content-Disposition": f'attachment; filename="episode_{episode_id}.mp4"',
        "Access-Control-Expose-Headers": "Content-Length, Content-Disposition",
    }
    if content_length:
        headers["Content-Length"] = content_length

    return StreamingResponse(stream(), media_type="video/mp4", headers=headers)


if _has_slowapi and limiter:
    @app.get("/catalog")
    @limiter.limit("60/minute")
    async def catalog(
        request: Request,
        page: int = Query(0, ge=0),
        per_page: int = Query(50, ge=10, le=100),
        sort: str = Query("title"),
        genre: str = Query(""),
        status: str = Query(""),
        year: str = Query(""),
        search: str = Query(""),
    ):
        """Paginated catalog with filters."""
        return await db.get_all(
            page=page,
            per_page=per_page,
            sort_by=sort,
            genre=genre,
            status=status,
            year=year,
            search=search,
        )
else:
    @app.get("/catalog")
    async def catalog(
        page: int = Query(0, ge=0),
        per_page: int = Query(50, ge=10, le=100),
        sort: str = Query("title"),
        genre: str = Query(""),
        status: str = Query(""),
        year: str = Query(""),
        search: str = Query(""),
    ):
        """Paginated catalog with filters."""
        return await db.get_all(
            page=page,
            per_page=per_page,
            sort_by=sort,
            genre=genre,
            status=status,
            year=year,
            search=search,
        )


@app.get("/filters")
async def filters():
    """Get all available filter values."""
    return {
        "genres": await db.get_all_genres(),
        "years": await db.get_all_years(),
        "statuses": await db.get_all_statuses(),
    }





@app.post("/cache/refresh", dependencies=[Depends(verify_admin_token)])
@limiter.limit("2/hour") if limiter else lambda f: f
async def refresh(request: Request):
    """Rebuild the entire database from scratch. Requires ADMIN_TOKEN if configured."""
    await db.clear()
    await asyncio.to_thread(scraper.build_full_index, db, loop=asyncio.get_running_loop())
    return {"status": "ok", "cached_anime": await db.count()}

@app.post("/sync-catalog", dependencies=[Depends(verify_admin_token)])
@limiter.limit("5/day") if limiter else lambda f: f
async def sync_catalog(request: Request, background_tasks: BackgroundTasks):
    """Manualmente avvia una sincronizzazione completa del catalogo (merge) in background."""
    background_tasks.add_task(daily_catalog_sync)
    return {"status": "ok", "message": "Sincronizzazione completa del catalogo avviata in background."}


# ----------------
@app.get("/manga/latest-chapters")
async def manga_latest_chapters():
    """Ultimi capitoli aggiornati dalla homepage di MangaWorld."""
    cache_key = "manga_latest_chapters"
    cached = cache_get(cache_key)
    if cached:
        return json.loads(cached)

    results = await asyncio.to_thread(manga_scraper.get_latest_chapters)
    if results:
        cache_set(cache_key, json.dumps(results), ex=600)  # cache 10 min
    return results

@app.get("/manga/sync-status")
async def manga_sync_status():
    """Stato della sincronizzazione archivio manga in corso."""
    return _manga_sync_status

@app.post("/manga/sync-archive")
async def manga_sync_archive(background_tasks: BackgroundTasks):
    """Avvia la sincronizzazione completa dell'archivio MangaWorld in background."""
    if _manga_sync_status["running"]:
        return {"status": "already_running", "message": "Sincronizzazione già in corso."}

    background_tasks.add_task(_run_manga_sync)
    return {"status": "started", "message": "Sincronizzazione archivio MangaWorld avviata in background."}

@app.get("/manga/search")
async def manga_search(q: str = Query(..., min_length=1)):
    """Cerca un manga tramite lo scraper (non usiamo il DB fuzzy per ora per semplicità)."""
    if not q.strip():
        raise HTTPException(400, "Query vuota")
    cache_key = f"manga_search:{q}"
    cached = cache_get(cache_key)
    if cached:
        return json.loads(cached)
        
    results = await asyncio.to_thread(manga_scraper.search, q.strip())
    response = {"query": q, "count": len(results), "results": results}
    cache_set(cache_key, json.dumps(response), ex=300)
    return response

@app.get("/manga/catalog")
async def manga_catalog(
    page: int = Query(0, ge=0),
    per_page: int = Query(50, ge=10, le=100),
    sort: str = Query("title"),
    genre: str = Query(""),
    status: str = Query(""),
    search: str = Query(""),
):
    """Paginated manga catalog with filters."""
    return await manga_db.get_all(
        page=page,
        per_page=per_page,
        sort_by=sort,
        genre=genre,
        status=status,
        search=search,
    )

@app.get("/manga/{manga_id}")
async def manga_detail(manga_id: str):
    """Dettaglio manga e capitoli."""
    base = await manga_db.get_by_id(manga_id)
    if not base:
        # Tenta di prelevare i dettagli direttamente
        manga_url = f"/manga/{manga_id.replace('---', '/')}"
        detail = await asyncio.to_thread(manga_scraper.get_manga_detail, manga_url)
        if not detail or not detail.get("chapters"):
            raise HTTPException(404, "Manga non trovato")
        
        base = {
            "id": manga_id,
            "url": manga_url,
            "title": detail.get("title") or manga_id.replace("-", " ").title(),
            "image": detail.get("cover", ""),
            "type": detail.get("type", ""),
            "genres": detail.get("genres", []),
            "status": detail.get("status", ""),
            "year": detail.get("year", ""),
            "rating": detail.get("rating", ""),
        }
        await manga_db.add_batch([base])
    else:
        detail = await asyncio.to_thread(manga_scraper.get_manga_detail, base["url"])
        
    chapters = detail.get("chapters", [])
    for ch in chapters:
        ch["manga_id"] = manga_id
    if chapters:
        await manga_db.add_chapters(chapters)
        
    return {**base, **detail}

@app.get("/manga/chapter/{chapter_id}/images")
async def get_chapter_images(chapter_id: str):
    """Ottieni le immagini di un capitolo."""
    # /read/manga-slug/en/chapter-number format typically
    # We will need the full url. We can assume the scraper handles just the chapter ID if we modify it, 
    # but currently get_chapter_images requires a full URL or relative URL. 
    # Let's search the DB for the chapter to get its URL.
    from sqlmodel import select
    from backend.database import engine, Chapter
    from sqlmodel.ext.asyncio.session import AsyncSession
    
    async with AsyncSession(engine) as session:
        result = await session.exec(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.one_or_none()
        
    if not chapter or not chapter.url:
        raise HTTPException(404, "Capitolo non trovato nel DB, visita prima la pagina del manga")
        
    images = await asyncio.to_thread(manga_scraper.get_chapter_images, chapter.url)
    return {"chapter_id": chapter_id, "images": images}

@app.get("/manga-watch")
async def get_manga_watch(
    session_id: str = Depends(get_or_create_session),
    limit: int = Query(12, ge=1, le=50)
):
    return await manga_db.get_recent_progress(session_id, limit)

@app.get("/manga-watch/{manga_id}")
async def get_manga_watch_item(manga_id: str, session_id: str = Depends(get_or_create_session)):
    progress = await manga_db.get_progress(session_id, manga_id)
    return progress or {"message": "No progress found"}

@app.post("/manga-watch/{manga_id}")
async def save_manga_watch(manga_id: str, chapter_id: str = Query(...), session_id: str = Depends(get_or_create_session)):
    await manga_db.save_progress(session_id, manga_id, chapter_id)
    return {"status": "saved", "manga_id": manga_id, "chapter_id": chapter_id}

@app.get("/manga-favorites")
async def get_manga_favorites(session_id: str = Depends(get_or_create_session)):
    return await manga_db.get_favorites(session_id)

@app.post("/manga-favorites/{manga_id}")
async def add_manga_favorite(manga_id: str, session_id: str = Depends(get_or_create_session)):
    await manga_db.save_favorite(session_id, manga_id)
    return {"status": "saved"}

@app.delete("/manga-favorites/{manga_id}")
async def remove_manga_favorite(manga_id: str, session_id: str = Depends(get_or_create_session)):
    await manga_db.remove_favorite(session_id, manga_id)
    return {"status": "deleted"}

@app.get("/manga-watchlist")
async def get_manga_watchlist(status: str = Query(""), session_id: str = Depends(get_or_create_session)):
    return await manga_db.get_watchlist(session_id, status_filter=status or None)

@app.post("/manga-watchlist/{manga_id}")
async def add_manga_watchlist(
    manga_id: str,
    status: str = Query("da_leggere"),
    chapters_read: int = Query(None),
    chapters_total: int = Query(None),
    notes: str = Query(None),
    session_id: str = Depends(get_or_create_session)
):
    await manga_db.save_watchlist(session_id, manga_id, status, chapters_read, chapters_total, notes)
    return {"status": "saved"}

@app.put("/manga-watchlist/{manga_id}")
async def update_manga_watchlist(
    manga_id: str,
    status: str = Query(...),
    chapters_read: int = Query(None),
    chapters_total: int = Query(None),
    notes: str = Query(None),
    session_id: str = Depends(get_or_create_session)
):
    await manga_db.save_watchlist(session_id, manga_id, status, chapters_read, chapters_total, notes)
    return {"status": "updated"}

@app.delete("/manga-watchlist/{manga_id}")
async def remove_manga_watchlist(manga_id: str, session_id: str = Depends(get_or_create_session)):
    await manga_db.remove_watchlist(session_id, manga_id)
    return {"status": "deleted"}


