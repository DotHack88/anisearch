"""
AniSearch — TMDB proxy router

Modulo separato per evitare il problema di caching bytecode di Uvicorn su Windows.
Importato da main.py come router FastAPI.
"""
import os
import re
import json
import logging

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()


def _clean_title(title: str) -> str:
    """Normalizza il titolo dell'anime per la ricerca su TMDB."""
    t = re.sub(r'\s*\(.*?\)', '', title)
    t = re.sub(r'\s+(?:the\s+)?movie\b.*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+(?:st|nd|rd|th)?\s*season\b.*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+ova\b.*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+ona\b.*', '', t, flags=re.IGNORECASE)
    return t.strip()


def _extract_season(title: str) -> int:
    """Estrae il numero di stagione dal titolo (es. 'Attack on Titan 2' → 2)."""
    m = re.search(r'(\d+)(?:st|nd|rd|th)?\s*season|(\d+)$', title, re.IGNORECASE)
    if m:
        return int(m.group(1) or m.group(2) or 1)
    return 1


@router.get("/tmdb/episode/{title}/{ep_number}")
async def get_tmdb_episode(title: str, ep_number: int):
    """Proxy per TMDB API — API key tenuta nel backend, mai esposta al frontend."""
    import httpx

    api_key = os.getenv("TMDB_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "TMDB_API_KEY non configurato nel backend")

    clean_title = _clean_title(title)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 1. Cerca il TV show
            search_url = (
                f"https://api.themoviedb.org/3/search/tv"
                f"?api_key={api_key}&language=it-IT&query={clean_title}"
            )
            search_res = await client.get(search_url)
            search_data = search_res.json()

        results = search_data.get("results", [])
        if not results:
            logger.debug(f"TMDB: nessun risultato per '{clean_title}'")
            return {"name": "", "error": "Non trovato su TMDB"}

        # Priorità: lingua giapponese + genere Animation (id=16)
        candidates = [r for r in results if r.get("original_language") == "ja" and 16 in r.get("genre_ids", [])]
        if not candidates:
            candidates = [r for r in results if 16 in r.get("genre_ids", [])]

        best = max(candidates, key=lambda x: x.get("popularity", 0)) if candidates else results[0]
        tv_id = best["id"]
        season = _extract_season(title)

        async with httpx.AsyncClient(timeout=10) as client:
            ep_url = (
                f"https://api.themoviedb.org/3/tv/{tv_id}"
                f"/season/{season}/episode/{ep_number}"
                f"?api_key={api_key}&language=it-IT"
            )
            ep_res = await client.get(ep_url)
            if not ep_res.is_success:
                return {"name": "", "error": "Episodio non trovato su TMDB"}
            ep_data = ep_res.json()

        return {"name": ep_data.get("name", "")}

    except httpx.TimeoutException:
        logger.warning(f"TMDB timeout per '{title}' ep {ep_number}")
        return {"name": "", "error": "Timeout TMDB"}
    except Exception as e:
        logger.error(f"TMDB error per '{title}' ep {ep_number}: {e}")
        raise HTTPException(500, "Errore nel recupero da TMDB")
