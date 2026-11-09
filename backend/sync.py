import os
import time
import httpx
import logging
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from backend.database import engine, User
from backend.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])

# Opaque state store: state -> {"user_id": str, "code_verifier": Optional[str], "expires": float}
_oauth_states: dict[str, dict] = {}

def _clean_expired_states():
    now = time.time()
    expired = [k for k, v in _oauth_states.items() if v.get("expires", 0) < now]
    for k in expired:
        _oauth_states.pop(k, None)

# --------- MyAnimeList Config ---------
MAL_CLIENT_ID = os.getenv("MAL_CLIENT_ID", "")
MAL_CLIENT_SECRET = os.getenv("MAL_CLIENT_SECRET", "")
MAL_REDIRECT_URI = os.getenv("MAL_REDIRECT_URI", "http://localhost:8000/sync/mal/callback")

# --------- AniList Config ---------
ANILIST_CLIENT_ID = os.getenv("ANILIST_CLIENT_ID", "")
ANILIST_CLIENT_SECRET = os.getenv("ANILIST_CLIENT_SECRET", "")
ANILIST_REDIRECT_URI = os.getenv("ANILIST_REDIRECT_URI", "http://localhost:8000/sync/anilist/callback")


# ==========================================
# MyAnimeList OAuth
# ==========================================
@router.get("/mal/login")
async def mal_login(token: str):
    """
    Inizia il flusso OAuth2 per MAL.
    L'app frontend passa il JWT per identificarsi; generiamo uno state opaco casuale per non esporre il JWT nelle URL di redirect.
    """
    if not MAL_CLIENT_ID:
        raise HTTPException(status_code=501, detail="MAL_CLIENT_ID non configurato nel server.")
    
    user = await get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Token utente non valido o scaduto.")

    _clean_expired_states()
    code_verifier = secrets.token_urlsafe(96)[:128]
    state_id = secrets.token_urlsafe(32)
    _oauth_states[state_id] = {
        "user_id": user.id,
        "code_verifier": code_verifier,
        "expires": time.time() + 600,
    }
    
    url = f"https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id={MAL_CLIENT_ID}&code_challenge={code_verifier}&state={state_id}"
    return RedirectResponse(url)

@router.get("/mal/callback")
async def mal_callback(code: str, state: str, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Errore OAuth MAL: {error}")
        
    _clean_expired_states()
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="State non valido o sessione OAuth scaduta.")
        
    user_id = state_data["user_id"]
    code_verifier = state_data["code_verifier"]

    data = {
        "client_id": MAL_CLIENT_ID,
        "client_secret": MAL_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": MAL_REDIRECT_URI
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post("https://myanimelist.net/v1/oauth2/token", data=data)
        if response.status_code != 200:
            logger.error(f"Errore MAL Token: {response.text}")
            raise HTTPException(status_code=400, detail="Impossibile ottenere il token da MAL.")
            
        token_data = response.json()
        mal_access_token = token_data.get("access_token")
        
    async with AsyncSession(engine) as session:
        db_user = await session.get(User, user_id)
        if db_user is None:
            raise HTTPException(status_code=404, detail="Utente non trovato.")
        db_user.mal_token = mal_access_token
        session.add(db_user)
        await session.commit()
            
    # Redirect al frontend (Home o Impostazioni)
    frontend_url = os.getenv("VITE_APP_URL", "http://localhost:5173")
    return RedirectResponse(f"{frontend_url}/?sync=success&provider=mal")


# ==========================================
# AniList OAuth
# ==========================================
@router.get("/anilist/login")
async def anilist_login(token: str):
    if not ANILIST_CLIENT_ID:
        raise HTTPException(status_code=501, detail="ANILIST_CLIENT_ID non configurato nel server.")
    
    user = await get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Token utente non valido o scaduto.")

    _clean_expired_states()
    state_id = secrets.token_urlsafe(32)
    _oauth_states[state_id] = {
        "user_id": user.id,
        "expires": time.time() + 600,
    }
    url = f"https://anilist.co/api/v2/oauth/authorize?client_id={ANILIST_CLIENT_ID}&response_type=code&redirect_uri={ANILIST_REDIRECT_URI}&state={state_id}"
    return RedirectResponse(url)

@router.get("/anilist/callback")
async def anilist_callback(code: str, state: str, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Errore OAuth AniList: {error}")
        
    _clean_expired_states()
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="State non valido o sessione OAuth scaduta.")

    user_id = state_data["user_id"]

    data = {
        "grant_type": "authorization_code",
        "client_id": ANILIST_CLIENT_ID,
        "client_secret": ANILIST_CLIENT_SECRET,
        "redirect_uri": ANILIST_REDIRECT_URI,
        "code": code
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post("https://anilist.co/api/v2/oauth/token", json=data)
        if response.status_code != 200:
            logger.error(f"Errore AniList Token: {response.text}")
            raise HTTPException(status_code=400, detail="Impossibile ottenere il token da AniList.")
            
        token_data = response.json()
        anilist_access_token = token_data.get("access_token")
        
    async with AsyncSession(engine) as session:
        db_user = await session.get(User, user_id)
        if db_user is None:
            raise HTTPException(status_code=404, detail="Utente non trovato.")
        db_user.anilist_token = anilist_access_token
        session.add(db_user)
        await session.commit()
            
    frontend_url = os.getenv("VITE_APP_URL", "http://localhost:5173")
    return RedirectResponse(f"{frontend_url}/?sync=success&provider=anilist")


# ==========================================
# Sync Background Tasks
# ==========================================

async def update_mal_progress_bg(mal_token: str, anime_title: str, episode_watched: int):
    """
    1. Cerca l'anime su MAL tramite titolo
    2. Aggiorna il watch progress dell'utente
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Search Anime
            headers = {"Authorization": f"Bearer {mal_token}"}
            search_res = await client.get(
                "https://api.myanimelist.net/v2/anime", 
                params={"q": anime_title, "limit": 1},
                headers=headers
            )
            
            if search_res.status_code != 200:
                logger.error(f"MAL Search failed: {search_res.text}")
                return
                
            data = search_res.json()
            if not data.get("data"):
                logger.info(f"Nessun anime trovato su MAL per il titolo: {anime_title}")
                return
                
            mal_id = data["data"][0]["node"]["id"]
            
            # 2. Update Progress
            update_data = {
                "num_watched_episodes": episode_watched,
                "status": "watching" # Puoi anche renderlo dinamico se `episodes_watched == total_episodes`
            }
            update_res = await client.put(
                f"https://api.myanimelist.net/v2/anime/{mal_id}/my_list_status",
                data=update_data,
                headers=headers
            )
            
            if update_res.status_code not in (200, 201):
                logger.error(f"MAL Update failed: {update_res.text}")
            else:
                logger.info(f"MAL Sync Success: {anime_title} Ep. {episode_watched}")
                
    except Exception as e:
        logger.error(f"Errore durante l'aggiornamento MAL: {str(e)}")


async def update_anilist_progress_bg(anilist_token: str, anime_title: str, episode_watched: int):
    """
    1. Cerca l'anime su AniList tramite titolo GraphQL
    2. Aggiorna la MediaList dell'utente
    """
    query_search = """
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
      }
    }
    """
    
    query_update = """
    mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
      SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
        id
        progress
      }
    }
    """
    
    try:
        headers = {
            "Authorization": f"Bearer {anilist_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Search Anime
            search_res = await client.post(
                "https://graphql.anilist.co",
                json={"query": query_search, "variables": {"search": anime_title}},
                headers=headers
            )
            
            if search_res.status_code != 200:
                logger.error(f"AniList Search failed: {search_res.text}")
                return
                
            data = search_res.json()
            if not data.get("data") or not data["data"].get("Media"):
                logger.info(f"Nessun anime trovato su AniList per il titolo: {anime_title}")
                return
                
            anilist_id = data["data"]["Media"]["id"]
            
            # 2. Update Progress
            update_res = await client.post(
                "https://graphql.anilist.co",
                json={
                    "query": query_update, 
                    "variables": {
                        "mediaId": anilist_id, 
                        "progress": episode_watched,
                        "status": "CURRENT"
                    }
                },
                headers=headers
            )
            
            if update_res.status_code != 200:
                logger.error(f"AniList Update failed: {update_res.text}")
            else:
                logger.info(f"AniList Sync Success: {anime_title} Ep. {episode_watched}")

    except Exception as e:
        logger.error(f"Errore durante l'aggiornamento AniList: {str(e)}")
