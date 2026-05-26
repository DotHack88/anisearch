import os
import json
import logging
from typing import List, Dict, Optional, Any

from sqlmodel import SQLModel, Field, select, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.ext.asyncio.engine import AsyncEngine

logger = logging.getLogger(__name__)

# Database file path (relative to this file)
DB_PATH = os.path.join(os.path.dirname(__file__), "anisearch.db")

# Async engine using aiosqlite
engine: AsyncEngine = create_engine(
    f"sqlite+aiosqlite:///{DB_PATH}",
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)

# ---------- Models ----------
class Anime(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    url: str
    image: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    year: Optional[str] = None
    rating: Optional[str] = None
    genres: Optional[str] = None  # JSON string stored in TEXT column

class Episode(SQLModel, table=True):
    id: str = Field(primary_key=True)
    anime_id: str = Field(foreign_key="anime.id")
    title: Optional[str] = None
    url: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    added_at: Optional[str] = None  # SQLite timestamp default handled by DB

class WatchProgress(SQLModel, table=True):
    anime_id: str = Field(primary_key=True, foreign_key="anime.id")
    episode_id: str = Field(foreign_key="episode.id")
    updated_at: Optional[str] = None

# ---------- Helper ----------
def _parse_genres(genres_str: Optional[str]) -> List[str]:
    if not genres_str:
        return []
    try:
        return json.loads(genres_str)
    except Exception:
        return []

def _serialize_genres(genres: List[str]) -> str:
    return json.dumps(genres)

def _row_to_dict(row: Any) -> dict:
    """Convert SQLModel instance to plain dict, handling JSON genres."""
    if row is None:
        return {}
    d = row.dict()
    d["genres"] = _parse_genres(d.get("genres"))
    return d

# ---------- Database class ----------
class AnimeDatabase:
    def __init__(self):
        # Ensure tables exist (run sync within async context)
        import asyncio
        asyncio.run(self._init_db())

    async def _init_db(self) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database tables created / verified.")

    # ----- Basic operations -----
    async def count(self) -> int:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime))
            return len(result.all())

    async def clear(self) -> None:
        async with AsyncSession(engine) as session:
            await session.exec("DELETE FROM watch_progress")
            await session.exec("DELETE FROM episode")
            await session.exec("DELETE FROM anime")
            await session.commit()
        logger.info("Database cleared — all tables emptied.")

    # ----- Anime -----
    async def add_batch(self, anime_list: List[Dict]) -> None:
        if not anime_list:
            return
        async with AsyncSession(engine) as session:
            for a in anime_list:
                obj = Anime(
                    id=a.get("id"),
                    title=a.get("title", ""),
                    url=a.get("url", ""),
                    image=a.get("image", ""),
                    type=a.get("type", ""),
                    status=a.get("status", ""),
                    year=a.get("year", ""),
                    rating=a.get("rating", ""),
                    genres=_serialize_genres(a.get("genres", [])),
                )
                session.add(obj)
            await session.commit()

    async def get_by_id(self, anime_id: str) -> Optional[dict]:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime).where(Anime.id == anime_id))
            anime = result.one_or_none()
            return _row_to_dict(anime) if anime else None

    async def get_all_genres(self) -> List[str]:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.genres))
            all_genres = set()
            for g in result.all():
                all_genres.update(_parse_genres(g))
            return sorted(all_genres)

    async def get_all_years(self) -> List[str]:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.year).where(Anime.year != None, Anime.year != ""))
            years = {y for (y,) in result.all()}
            return sorted(years, reverse=True)

    async def get_all_statuses(self) -> List[str]:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.status).where(Anime.status != None, Anime.status != ""))
            statuses = {s for (s,) in result.all()}
            return sorted(statuses)

    async def search_exact_or_fuzzy_fallback(self, query: str, limit: int = 20) -> List[dict]:
        pattern = f"%{query}%"
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime).where(Anime.title.like(pattern)).limit(limit))
            rows = result.all()
            return [_row_to_dict(r) for r in rows]

    async def get_all(
        self,
        page: int = 0,
        per_page: int = 50,
        sort_by: str = "title",
        genre: str = "",
        status: str = "",
        year: str = "",
        search: str = "",
    ) -> dict:
        async with AsyncSession(engine) as session:
            stmt = select(Anime)
            if search:
                stmt = stmt.where(Anime.title.like(f"%{search}%"))
            if genre:
                stmt = stmt.where(Anime.genres.like(f'%"{genre}"%'))
            if status:
                stmt = stmt.where(Anime.status == status)
            if year:
                stmt = stmt.where(Anime.year == year)
            # Sorting
            if sort_by == "title":
                stmt = stmt.order_by(Anime.title.asc())
            elif sort_by == "year":
                stmt = stmt.order_by(Anime.year.desc())
            elif sort_by == "rating":
                stmt = stmt.order_by(Anime.rating.cast(float).desc())
            # Total count
            total_res = await session.exec(select([func.count()]).select_from(stmt.subquery()))
            total = total_res.one()
            # Pagination
            stmt = stmt.offset(page * per_page).limit(per_page)
            rows = await session.exec(stmt)
            items = [_row_to_dict(r) for r in rows.all()]
            return {
                "items": items,
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page if total > 0 else 0,
            }

    # ----- Episodes -----
    async def add_episodes(self, episodes: List[Dict]) -> None:
        if not episodes:
            return
        async with AsyncSession(engine) as session:
            for ep in episodes:
                obj = Episode(
                    id=ep.get("id"),
                    anime_id=ep.get("anime_id"),
                    title=ep.get("title", ""),
                    url=ep.get("url", ""),
                    season=ep.get("season"),
                    episode=ep.get("episode") or ep.get("number"),
                )
                session.add(obj)
            await session.commit()

    async def get_recent_episodes(self, limit: int = 20) -> List[dict]:
        async with AsyncSession(engine) as session:
            stmt = (
                select(Episode, Anime.title.label("anime_title"), Anime.image.label("anime_image"))
                .join(Anime, Episode.anime_id == Anime.id)
                .order_by(Episode.added_at.desc())
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            return [dict(r) for r in rows]

    # ----- Watch Progress -----
    async def save_watch_progress(self, anime_id: str, episode_id: str) -> None:
        async with AsyncSession(engine) as session:
            wp = WatchProgress(anime_id=anime_id, episode_id=episode_id)
            session.add(wp)
            await session.commit()

    async def get_watch_progress(self, anime_id: str) -> Optional[dict]:
        async with AsyncSession(engine) as session:
            result = await session.exec(select(WatchProgress).where(WatchProgress.anime_id == anime_id))
            wp = result.one_or_none()
            if wp:
                return {"episode_id": wp.episode_id, "updated_at": wp.updated_at}
            return None

    async def delete_watch_progress(self, anime_id: str) -> None:
        async with AsyncSession(engine) as session:
            await session.exec(delete(WatchProgress).where(WatchProgress.anime_id == anime_id))
            await session.commit()

    async def get_recent_watch_progress(self, limit: int = 10) -> List[dict]:
        async with AsyncSession(engine) as session:
            stmt = (
                select(WatchProgress, Anime.title.label("anime_title"), Anime.image.label("anime_image"), Episode.episode.label("episode_number"))
                .join(Anime, WatchProgress.anime_id == Anime.id)
                .join(Episode, WatchProgress.episode_id == Episode.id)
                .order_by(WatchProgress.updated_at.desc())
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            return [dict(r) for r in rows]
