"""
AniSearch — Backend API (FastAPI)
"""

import os
import sys
from pathlib import Path
from typing import Any

# Aggiungi la cartella radice del progetto al percorso di ricerca di Python
sys.path.append(str(Path(__file__).resolve().parent.parent))

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
    val = redis_client.get(key)
    if val is None:
        return None
    if isinstance(val, bytes):
        return val.decode("utf-8")
    return str(val)

def cache_set(key: str, value: Any, ex: int = 300) -> None:
    if redis_client:
        redis_client.set(key, value, ex=ex)

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from backend.scraper import AnimeWorldScraper
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.database import AnimeDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

db = AnimeDatabase()
scraper = AnimeWorldScraper()
scheduler = AsyncIOScheduler()

def scheduled_update():
    logger.info("Avvio job schedulato per ricerca nuovi episodi...")
    scraper.scrape_latest_updates(db)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eseguiamo lo scraping massivo solo se il DB è vuoto
    if db.count() == 0:
        logger.info("Database vuoto — Avvio scraping iniziale completo (potrebbe richiedere minuti)...")
        try:
            await asyncio.to_thread(scraper.build_full_index, db)
            logger.info(f"Database pronto: {db.count()} anime salvati.")
        except Exception as e:
            logger.error(f"Errore popolamento db: {e}")
    else:
        logger.info(f"Avvio rapido — Database già popolato con {db.count()} anime.")
        
    # Avvio Scheduler
    scheduler.add_job(scheduled_update, 'interval', minutes=60)
    scheduler.start()
    logger.info("Scheduler avviato: controllerà nuovi episodi ogni 60 minuti.")
    
    yield
    
    # Spegnimento Scheduler
    scheduler.shutdown()
    logger.info("Scheduler fermato.")


app = FastAPI(title="AniSearch API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    """API root — welcome message and available endpoints."""
    return {
        "name": "AniSearch API",
        "version": "2.0.0",
        "endpoints": [
            "GET  /status",
            "GET  /search?q=...",
            "GET  /catalog",
            "GET  /filters",
            "GET  /new",
            "GET  /anime/{anime_id}",
            "GET  /episode/{episode_id}/video",
            "GET  /watch/{anime_id}",
            "POST /watch/{anime_id}?episode_id=...",
        ],
    }


@app.get("/status")
def status():
    return {
        "status": "online",
        "cached_anime": db.count(),
        "cache_ready": db.count() > 0,
    }


@app.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)):
    if not q.strip():
        raise HTTPException(400, "Query vuota")
    cache_key = f"search:{q}:{limit}"
    cached = cache_get(cache_key)
    if cached:
        import json
        return json.loads(cached)
    results = db.search_exact_or_fuzzy_fallback(q.strip(), limit=limit)
    response = {"query": q, "count": len(results), "results": results}
    # Store in Redis for 5 minutes
    import json
    cache_set(cache_key, json.dumps(response), ex=300)
    return response



@app.get("/new")
def new_updates(limit: int = Query(20, ge=1, le=100)):
    """Return the most recent episodes added by the scheduler."""
    episodes = db.get_recent_episodes(limit)
    return {"limit": limit, "episodes": episodes}

@app.get("/watch")
def get_all_watch(limit: int = Query(12, ge=1, le=50)):
    """Get recent watch progress items for all anime."""
    return db.get_recent_watch_progress(limit)

@app.get("/watch/{anime_id}")
def get_watch(anime_id: str):
    """Get the last watched episode for an anime."""
    progress = db.get_watch_progress(anime_id)
    return progress or {"message": "No progress found"}

@app.delete("/watch/{anime_id}")
def delete_watch(anime_id: str, episode_id: str = Query(...)):
    """Delete watch progress for given anime (ignore episode_id)."""
    db.delete_watch_progress(anime_id)
    return {"status": "deleted", "anime_id": anime_id}

@app.post("/watch/{anime_id}")
def save_watch(anime_id: str, episode_id: str = Query(...)):
    """Save watch progress for a given anime and episode."""
    db.save_watch_progress(anime_id, episode_id)
    return {"status": "saved", "anime_id": anime_id, "episode_id": episode_id}


# Extend anime_detail to store episodes after fetching
@app.get("/anime/{anime_id}")
async def anime_detail(anime_id: str):
    base = db.get_by_id(anime_id)
    if not base:
        raise HTTPException(404, "Anime non trovato")
    try:
        detail = await asyncio.to_thread(scraper.get_anime_detail, base["url"])
        # Store episodes in DB if present
        episodes = detail.get("episodes", [])
        for ep in episodes:
            ep["anime_id"] = anime_id
        if episodes:
            db.add_episodes(episodes)
        return {**base, **detail}
    except Exception as e:
        logger.error(f"Errore dettaglio {anime_id}: {e}")
        return {**base, "episodes": [], "error": "Impossibile caricare gli episodi"}



@app.get("/episode/{episode_id}/video")
async def episode_video(episode_id: str):
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


@app.get("/catalog")
def catalog(
    page: int = Query(0, ge=0),
    per_page: int = Query(50, ge=10, le=100),
    sort: str = Query("title"),
    genre: str = Query(""),
    status: str = Query(""),
    year: str = Query(""),
    search: str = Query(""),
):
    """Paginated catalog with filters."""
    return db.get_all(
        page=page,
        per_page=per_page,
        sort_by=sort,
        genre=genre,
        status=status,
        year=year,
        search=search,
    )


@app.get("/filters")
def filters():
    """Get all available filter values."""
    return {
        "genres": db.get_all_genres(),
        "years": db.get_all_years(),
        "statuses": db.get_all_statuses(),
    }


@app.post("/cache/refresh")
async def refresh():
    db.clear()
    await asyncio.to_thread(scraper.build_full_index, db)
    return {"status": "ok", "cached_anime": db.count()}


@app.get("/debug/page/{letter}")
async def debug_page(letter: str = "N"):
    """
    Debug: analizza la struttura HTML di una pagina AZ.
    Apri http://localhost:8000/debug/page/N per vedere cosa trova il scraper.
    """
    result = await asyncio.to_thread(scraper.debug_page, letter.upper())
    return result
