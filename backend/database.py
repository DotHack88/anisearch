import os
import json
import logging
from typing import List, Dict, Optional, Any

from sqlmodel import SQLModel, Field, select
from sqlalchemy import func, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

logger = logging.getLogger(__name__)

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    # asyncpg expects 'ssl=require' not 'sslmode=require'
    DATABASE_URL = DATABASE_URL.replace("sslmode=require", "ssl=require")
    # asyncpg does not support channel_binding
    DATABASE_URL = DATABASE_URL.replace("&channel_binding=require", "")

    engine: AsyncEngine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
    )
else:
    # Fallback to local SQLite
    DB_PATH = os.path.join(os.path.dirname(__file__), "anisearch.db")
    engine: AsyncEngine = create_async_engine(
        f"sqlite+aiosqlite:///{DB_PATH}",
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
    )

# ---------- Models ----------
class Anime(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    title: str = Field(default="")
    url: str = Field(default="")
    image: Optional[str] = Field(default=None)
    type: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None)
    year: Optional[str] = Field(default=None)
    rating: Optional[str] = Field(default=None)
    genres: Optional[str] = Field(default=None)  # JSON string stored in TEXT column

class Episode(SQLModel, table=True):
    id: str = Field(primary_key=True)
    anime_id: str = Field(foreign_key="anime.id")
    title: Optional[str] = None
    url: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    added_at: Optional[str] = None  # SQLite timestamp default handled by DB

class WatchProgress(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
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
    d = row.model_dump() if hasattr(row, 'model_dump') else row.dict() if hasattr(row, 'dict') else {}
    d["genres"] = _parse_genres(d.get("genres"))
    return d

# ---------- Database class ----------
class AnimeDatabase:
    def __init__(self):
        self._initialized = False

    async def _ensure_init(self) -> None:
        """Lazy init: create tables on first async call."""
        if self._initialized:
            return
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self._initialized = True
        logger.info("Database tables created / verified.")

    # ----- Basic operations -----
    async def count(self) -> int:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(func.count()).select_from(Anime))
            return result.one()

    async def clear(self) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(WatchProgress))
            await session.exec(delete(Episode))
            await session.exec(delete(Anime))
            await session.commit()
        logger.info("Database cleared — all tables emptied.")

    # ----- Anime -----
    async def add_batch(self, anime_list: List[Dict], mode: str = "replace") -> None:
        await self._ensure_init()
        if not anime_list:
            return

        # Build list of row dicts for bulk upsert
        rows = [
            {
                "id": a.get("id"),
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "image": a.get("image", ""),
                "type": a.get("type", ""),
                "status": a.get("status", ""),
                "year": a.get("year", ""),
                "rating": a.get("rating", ""),
                "genres": _serialize_genres(a.get("genres", [])),
            }
            for a in anime_list
            if a.get("id")  # Skip rows without ID
        ]
        if not rows:
            return

        async with engine.begin() as conn:
            dialect_name = engine.dialect.name
            if dialect_name == "postgresql":
                stmt = pg_insert(Anime).values(rows)
                if mode == "ignore":
                    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
                else:
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["id"],
                        set_={
                            "title": stmt.excluded.title,
                            "url": stmt.excluded.url,
                            "image": stmt.excluded.image,
                            "type": stmt.excluded.type,
                            "status": stmt.excluded.status,
                            "year": stmt.excluded.year,
                            "rating": stmt.excluded.rating,
                            "genres": stmt.excluded.genres,
                        },
                    )
            else:
                # SQLite: use INSERT OR REPLACE
                stmt = sqlite_insert(Anime).values(rows)
                if mode == "ignore":
                    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
                else:
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["id"],
                        set_={
                            "title": stmt.excluded.title,
                            "url": stmt.excluded.url,
                            "image": stmt.excluded.image,
                            "type": stmt.excluded.type,
                            "status": stmt.excluded.status,
                            "year": stmt.excluded.year,
                            "rating": stmt.excluded.rating,
                            "genres": stmt.excluded.genres,
                        },
                    )
            await conn.execute(stmt)

    async def get_by_id(self, anime_id: str) -> Optional[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime).where(Anime.id == anime_id))
            anime = result.one_or_none()
            return _row_to_dict(anime) if anime else None

    async def get_all_genres(self) -> List[str]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.genres))
            all_genres = set()
            for g in result.all():
                all_genres.update(_parse_genres(g))
            return sorted(all_genres)

    async def get_all_years(self) -> List[str]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.year).where(Anime.year.isnot(None), Anime.year != ""))
            years = {y for y in result.all() if y}
            return sorted(years, reverse=True)

    async def get_all_statuses(self) -> List[str]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.status).where(Anime.status.isnot(None), Anime.status != ""))
            statuses = {s for s in result.all() if s}
            return sorted(statuses)

    async def search_exact_or_fuzzy_fallback(self, query: str, limit: int = 20) -> List[dict]:
        await self._ensure_init()
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
        await self._ensure_init()
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
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total_res = await session.exec(count_stmt)
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
        await self._ensure_init()
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
                await session.merge(obj)
            await session.commit()

    async def get_recent_episodes(self, limit: int = 20) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Episode, Anime.title.label("anime_title"), Anime.image.label("anime_image"))
                .join(Anime, Episode.anime_id == Anime.id)
                .order_by(Episode.added_at.desc())
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            episodes = []
            for row in rows:
                if hasattr(row, '_asdict'):
                    episodes.append(row._asdict())
                elif isinstance(row, tuple) and len(row) >= 1:
                    obj = row[0]
                    ep = obj.model_dump() if hasattr(obj, 'model_dump') else obj.dict() if hasattr(obj, 'dict') else {}
                    if len(row) > 1:
                        ep["anime_title"] = row[1]
                    if len(row) > 2:
                        ep["anime_image"] = row[2]
                    episodes.append(ep)
                else:
                    episodes.append(dict(row) if hasattr(row, '__iter__') else {})
            return episodes

    # ----- Watch Progress -----
    async def save_watch_progress(self, session_id: str, anime_id: str, episode_id: str) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))
            wp = result.one_or_none()
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if wp:
                wp.episode_id = episode_id
                wp.updated_at = now_str
            else:
                wp = WatchProgress(session_id=session_id, anime_id=anime_id, episode_id=episode_id, updated_at=now_str)
                session.add(wp)
            await session.commit()

    async def get_watch_progress(self, session_id: str, anime_id: str) -> Optional[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))
            wp = result.one_or_none()
            if wp:
                return {"episode_id": wp.episode_id, "updated_at": wp.updated_at}
            return None

    async def delete_watch_progress(self, session_id: str, anime_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))
            await session.commit()

    async def get_recent_watch_progress(self, session_id: str, limit: int = 10) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(WatchProgress, Anime.title.label("anime_title"), Anime.image.label("anime_image"), Episode.episode.label("episode_number"))
                .join(Anime, WatchProgress.anime_id == Anime.id)
                .join(Episode, WatchProgress.episode_id == Episode.id)
                .where(WatchProgress.session_id == session_id)
                .order_by(WatchProgress.updated_at.desc())
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            watch_progresses = []
            for row in rows:
                wp_obj = row[0]
                wp_dict = wp_obj.model_dump() if hasattr(wp_obj, 'model_dump') else wp_obj.dict() if hasattr(wp_obj, 'dict') else {}
                wp_dict["anime_title"] = row[1]
                wp_dict["anime_image"] = row[2]
                wp_dict["episode_number"] = row[3]
                watch_progresses.append(wp_dict)
            return watch_progresses
