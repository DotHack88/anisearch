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
from pathlib import Path
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Header, Request, Depends, Cookie, Response
from fastapi.middleware.cors import CORSMiddleware

# Add project root to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.scraper import AnimeWorldScraper  # noqa: E402
from backend.database import AnimeDatabase  # noqa: E402
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration from environment ---
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
raw_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

db = AnimeDatabase()
scraper = AnimeWorldScraper()
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eseguiamo lo scraping massivo solo se il DB è vuoto
    if await db.count() == 0:
        logger.info("Database vuoto — Avvio scraping iniziale completo (potrebbe richiedere minuti)...")
        try:
            await asyncio.to_thread(scraper.build_full_index, db, loop=asyncio.get_running_loop())
            logger.info(f"Database pronto: {await db.count()} anime salvati.")
        except Exception as e:
            logger.error(f"Errore popolamento db: {e}")
    else:
        logger.info(f"Avvio rapido — Database già popolato con {await db.count()} anime.")
        
    if not os.getenv("ADMIN_TOKEN"):
        warnings.warn(
            "ADMIN_TOKEN non è impostato. "
            "L'endpoint /cache/refresh non funzionerà.",
            RuntimeWarning
        )
        
    # Avvio Scheduler
    scheduler.add_job(scheduled_update, 'interval', minutes=15)
    scheduler.add_job(daily_catalog_sync, 'interval', hours=24)
    scheduler.start()
    logger.info("Scheduler avviato: controllerà nuovi episodi ogni 15 minuti e farà un sync completo ogni 24 ore.")
    
    yield
    
    # Spegnimento Scheduler
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

# --- Rate limiting setup ---
if _has_slowapi:
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
else:
    limiter = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


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
    return {
        "status": "online",
        "cached_anime": await db.count(),
        "cache_ready": await db.count() > 0,
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
    response: Response,
    anisearch_session: str | None = Cookie(default=None)
) -> str:
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


# Extend anime_detail to store episodes after fetching
@app.get("/anime/{anime_id}")
async def anime_detail(anime_id: str):
    base = await db.get_by_id(anime_id)
    if not base:
        raise HTTPException(404, "Anime non trovato")
    try:
        detail = await asyncio.to_thread(scraper.get_anime_detail, base["url"])
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
        result = await asyncio.to_thread(scraper.get_episode_video_url, episode_id)
        if result.get("video_url"):
            return result
        raise HTTPException(404, result.get("error", "Video non trovato"))
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
