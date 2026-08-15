import os
import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field, select, col
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
class User(SQLModel, table=True):
    id: str = Field(primary_key=True)  # UUID stored as string
    email: Optional[str] = Field(default=None, unique=True, index=True)
    hashed_password: Optional[str] = Field(default=None)
    username: str = Field(index=True)
    avatar_url: Optional[str] = Field(default=None)
    
    # OAuth Provider IDs
    google_id: Optional[str] = Field(default=None, unique=True, index=True)
    discord_id: Optional[str] = Field(default=None, unique=True, index=True)
    
    # Provider Access Tokens (for Sync)
    mal_token: Optional[str] = Field(default=None)
    anilist_token: Optional[str] = Field(default=None)
    
    created_at: Optional[str] = None

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

class Favorite(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
    anime_id: str = Field(primary_key=True, foreign_key="anime.id")
    added_at: Optional[str] = None

class Watchlist(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
    anime_id: str = Field(primary_key=True, foreign_key="anime.id")
    # stati: "da_guardare" | "in_visione" | "completato" | "in_pausa" | "abbandonato"
    status: str = Field(default="da_guardare")
    episodes_watched: Optional[int] = Field(default=0)
    episodes_total: Optional[int] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    added_at: Optional[str] = None
    last_update: Optional[str] = None
    completed_at: Optional[str] = None

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    anime_id: str = Field(foreign_key="anime.id")
    episode_id: str = Field(foreign_key="episode.id")
    message: str
    is_read: bool = Field(default=False)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PushSubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    endpoint: str = Field(unique=True)
    auth: str
    p256dh: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ---------- Manga Models ----------
class Manga(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    title: str = Field(default="")
    url: str = Field(default="")
    image: Optional[str] = Field(default=None)
    type: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None)
    year: Optional[str] = Field(default=None)
    rating: Optional[str] = Field(default=None)
    genres: Optional[str] = Field(default=None)  # JSON string stored in TEXT column

class Chapter(SQLModel, table=True):
    id: str = Field(primary_key=True)
    manga_id: str = Field(foreign_key="manga.id")
    title: Optional[str] = None
    url: Optional[str] = None
    volume: Optional[int] = None
    chapter: Optional[float] = None
    added_at: Optional[str] = None

class MangaProgress(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
    manga_id: str = Field(primary_key=True, foreign_key="manga.id")
    chapter_id: str = Field(foreign_key="chapter.id")
    updated_at: Optional[str] = None

class MangaFavorite(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
    manga_id: str = Field(primary_key=True, foreign_key="manga.id")
    added_at: Optional[str] = None

class MangaWatchlist(SQLModel, table=True):
    session_id: str = Field(primary_key=True)
    manga_id: str = Field(primary_key=True, foreign_key="manga.id")
    # stati: "da_leggere" | "in_lettura" | "completato" | "in_pausa" | "abbandonato"
    status: str = Field(default="da_leggere")
    chapters_read: Optional[int] = Field(default=0)
    chapters_total: Optional[int] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    added_at: Optional[str] = None
    last_update: Optional[str] = None
    completed_at: Optional[str] = None

# ---------- Helper ----------
def _parse_genres(genres_str: Optional[str]) -> List[str]:
    if not genres_str:
        return []
    try:
        parsed = json.loads(genres_str)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, str):
            return [g.strip() for g in parsed.replace(",", " ").split() if g.strip()]
    except Exception:
        pass
    return [g.strip() for g in genres_str.replace(",", " ").split() if g.strip()]

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

    async def count_episodes(self) -> int:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(func.count()).select_from(Episode))
            return result.one()

    async def clear(self) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(MangaProgress))
            await session.exec(delete(MangaFavorite))
            await session.exec(delete(MangaWatchlist))
            await session.exec(delete(Chapter))
            await session.exec(delete(Manga))
            await session.exec(delete(Notification))
            await session.exec(delete(PushSubscription))
            await session.exec(delete(WatchProgress))
            await session.exec(delete(Favorite))
            await session.exec(delete(Watchlist))
            await session.exec(delete(Episode))
            await session.exec(delete(Anime))
            await session.commit()
        logger.info("Database cleared — all tables emptied.")

    # ----- Push Subscriptions -----
    async def save_push_subscription(self, session_id: str, endpoint: str, auth: str, p256dh: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
            sub = result.one_or_none()
            if sub:
                sub.session_id = session_id
                sub.auth = auth
                sub.p256dh = p256dh
            else:
                sub = PushSubscription(session_id=session_id, endpoint=endpoint, auth=auth, p256dh=p256dh)
                session.add(sub)
            await session.commit()
            
    async def get_push_subscriptions(self, session_ids: List[str]) -> List[dict]:
        await self._ensure_init()
        if not session_ids:
            return []
        async with AsyncSession(engine) as session:
            stmt = select(PushSubscription).where(col(PushSubscription.session_id).in_(session_ids))
            result = await session.exec(stmt)
            return [_row_to_dict(s) for s in result.all()]

    async def delete_push_subscription(self, endpoint: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            existing = await session.exec(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
            sub = existing.one_or_none()
            if sub:
                await session.delete(sub)
            await session.commit()

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

        # Deduplicate rows by ID to avoid CardinalityViolationError in PostgreSQL
        seen_ids = set()
        deduped_rows = []
        for r in rows:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                deduped_rows.append(r)
        rows = deduped_rows

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
            result = await session.exec(select(Anime.year).where(Anime.year.isnot(None), Anime.year != ""))  # type: ignore
            years = {y for y in result.all() if y}
            return sorted(years, reverse=True)

    async def get_all_statuses(self) -> List[str]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime.status).where(Anime.status.isnot(None), Anime.status != ""))  # type: ignore
            statuses = {s for s in result.all() if s}
            return sorted(statuses)

    async def search_exact_or_fuzzy_fallback(self, query: str, limit: int = 20) -> List[dict]:
        await self._ensure_init()
        pattern = f"%{query}%"
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime).where(func.lower(Anime.title).like(func.lower(pattern))).limit(limit))
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
                stmt = stmt.where(func.lower(Anime.title).like(func.lower(f"%{search}%")))
            if genre:
                stmt = stmt.where(Anime.genres.like(f'%"{genre}"%'))  # type: ignore
            if status:
                stmt = stmt.where(Anime.status == status)
            if year:
                stmt = stmt.where(Anime.year == year)
            # Sorting
            if sort_by == "title":
                stmt = stmt.order_by(Anime.title.asc())  # type: ignore
            elif sort_by == "year":
                stmt = stmt.order_by(Anime.year.desc())  # type: ignore
            elif sort_by == "rating":
                stmt = stmt.order_by(Anime.rating.cast(float).desc())  # type: ignore
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
    @staticmethod
    def _to_int(value) -> Optional[int]:
        """Safely cast a value to int, returning None on failure."""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    async def add_episodes(self, episodes: List[Dict]) -> None:
        await self._ensure_init()
        if not episodes:
            return

        rows = [
            {
                "id": ep.get("id"),
                "anime_id": ep.get("anime_id"),
                "title": ep.get("title", ""),
                "url": ep.get("url", ""),
                "season": self._to_int(ep.get("season")),
                "episode": self._to_int(ep.get("episode") or ep.get("number")),
                "added_at": ep.get("added_at"),
            }
            for ep in episodes
            if ep.get("id") and ep.get("anime_id")
        ]
        if not rows:
            return

        # Deduplicate rows by ID to avoid potential constraints / Cardinality errors in PostgreSQL
        seen_ids = set()
        deduped_rows = []
        for r in rows:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                deduped_rows.append(r)
        rows = deduped_rows

        async with engine.begin() as conn:
            dialect_name = engine.dialect.name
            if dialect_name == "postgresql":
                stmt = pg_insert(Episode).values(rows).on_conflict_do_nothing(index_elements=["id"])
            else:
                stmt = sqlite_insert(Episode).values(rows).on_conflict_do_nothing(index_elements=["id"])
            await conn.execute(stmt)

    async def get_recent_episodes(self, limit: int = 20) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Episode, Anime.title.label("anime_title"), Anime.image.label("anime_image"))  # type: ignore
                .join(Anime, Episode.anime_id == Anime.id)  # type: ignore
                .order_by(Episode.added_at.desc())  # type: ignore
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
                    ep = obj.model_dump()
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
            result = await session.exec(select(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))  # type: ignore
            wp = result.one_or_none()
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if wp:
                wp.episode_id = episode_id
                wp.updated_at = now_str
            else:
                wp = WatchProgress(session_id=session_id, anime_id=anime_id, episode_id=episode_id, updated_at=now_str)
                session.add(wp)
                
            # Sync with Watchlist
            ep_res = await session.exec(select(Episode).where(Episode.id == episode_id))
            ep = ep_res.one_or_none()
            if ep and ep.episode is not None:
                wl_res = await session.exec(select(Watchlist).where(Watchlist.anime_id == anime_id, Watchlist.session_id == session_id))
                wl = wl_res.one_or_none()
                ep_num = ep.episode
                if wl:
                    # Update if the watched episode number is greater than the currently saved one
                    if not wl.episodes_watched or ep_num > wl.episodes_watched:
                        wl.episodes_watched = ep_num
                        wl.last_update = now_str
                        # Automatically mark as complete if it reached the total
                        if wl.episodes_total and ep_num >= wl.episodes_total:
                            wl.status = "completato"
                            if not wl.completed_at:
                                wl.completed_at = now_str
                        elif wl.status == "da_guardare":
                            wl.status = "in_visione"
                else:
                    # Automatically add to watchlist if it wasn't there
                    wl = Watchlist(
                        session_id=session_id,
                        anime_id=anime_id,
                        status="in_visione",
                        episodes_watched=ep_num,
                        episodes_total=None,
                        added_at=now_str,
                        last_update=now_str,
                    )
                    session.add(wl)
            
            await session.commit()

    async def get_watch_progress(self, session_id: str, anime_id: str) -> Optional[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))  # type: ignore
            wp = result.one_or_none()
            if wp:
                return {"episode_id": wp.episode_id, "updated_at": wp.updated_at}
            return None

    async def delete_watch_progress(self, session_id: str, anime_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(WatchProgress).where(WatchProgress.anime_id == anime_id, WatchProgress.session_id == session_id))  # type: ignore
            await session.commit()

    async def get_recent_watch_progress(self, session_id: str, limit: int = 10) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(WatchProgress, Anime.title.label("anime_title"), Anime.image.label("anime_image"), Episode.episode.label("episode_number"))  # type: ignore
                .outerjoin(Anime, WatchProgress.anime_id == Anime.id)  # type: ignore
                .outerjoin(Episode, WatchProgress.episode_id == Episode.id)  # type: ignore
                .where(WatchProgress.session_id == session_id)  # type: ignore
                .order_by(WatchProgress.updated_at.desc())  # type: ignore
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            watch_progresses = []
            for row in rows:
                wp_obj = row[0]
                wp_dict = wp_obj.model_dump()
                wp_dict["anime_title"] = row[1] or f"Anime {wp_obj.anime_id}"
                wp_dict["anime_image"] = row[2] or f"https://img.animeworld.ac/locandine/{wp_obj.anime_id}.jpg"
                wp_dict["episode_number"] = row[3] or "?"
                watch_progresses.append(wp_dict)
            return watch_progresses

    # ----- Favorites -----
    async def save_favorite(self, session_id: str, anime_id: str) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Favorite).where(Favorite.anime_id == anime_id, Favorite.session_id == session_id))  # type: ignore
            fav = result.one_or_none()
            if not fav:
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                fav = Favorite(session_id=session_id, anime_id=anime_id, added_at=now_str)
                session.add(fav)
                await session.commit()

    async def remove_favorite(self, session_id: str, anime_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(Favorite).where(Favorite.anime_id == anime_id, Favorite.session_id == session_id))  # type: ignore
            await session.commit()

    async def get_favorites(self, session_id: str) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Anime)
                .join(Favorite, Favorite.anime_id == Anime.id)  # type: ignore
                .where(Favorite.session_id == session_id)  # type: ignore
                .order_by(Favorite.added_at.desc())  # type: ignore
            )
            result = await session.exec(stmt)
            rows = result.all()
            return [_row_to_dict(r) for r in rows]

    # ----- Watchlist -----
    async def save_watchlist(
        self,
        session_id: str,
        anime_id: str,
        status: str = "da_guardare",
        episodes_watched: Optional[int] = None,
        episodes_total: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Watchlist).where(Watchlist.anime_id == anime_id, Watchlist.session_id == session_id))  # type: ignore
            item = result.one_or_none()
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if item:
                item.status = status
                item.last_update = now_str
                if episodes_watched is not None:
                    item.episodes_watched = episodes_watched
                if episodes_total is not None:
                    item.episodes_total = episodes_total
                if notes is not None:
                    item.notes = notes
                if status == "completato" and not item.completed_at:
                    item.completed_at = now_str
                elif status != "completato":
                    item.completed_at = None
            else:
                item = Watchlist(
                    session_id=session_id,
                    anime_id=anime_id,
                    status=status,
                    episodes_watched=episodes_watched or 0,
                    episodes_total=episodes_total,
                    notes=notes,
                    added_at=now_str,
                    last_update=now_str,
                    completed_at=now_str if status == "completato" else None,
                )
                session.add(item)
            await session.commit()

    async def remove_watchlist(self, session_id: str, anime_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(Watchlist).where(Watchlist.anime_id == anime_id, Watchlist.session_id == session_id))  # type: ignore
            await session.commit()

    async def get_watchlist(self, session_id: str, status_filter: Optional[str] = None) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            # Join Watchlist → Anime (required), then outer-join WatchProgress and Episode
            # to pick up the actual last-watched episode number as a fallback
            stmt = (
                select(
                    Anime,
                    Watchlist,
                    Episode.episode.label("wp_episode_number"),  # type: ignore
                )
                .join(Watchlist, Watchlist.anime_id == Anime.id)  # type: ignore
                .outerjoin(
                    WatchProgress,
                    (WatchProgress.anime_id == Anime.id) & (WatchProgress.session_id == session_id),  # type: ignore
                )
                .outerjoin(Episode, Episode.id == WatchProgress.episode_id)  # type: ignore
                .where(Watchlist.session_id == session_id)  # type: ignore
            )
            if status_filter:
                stmt = stmt.where(Watchlist.status == status_filter)
            stmt = stmt.order_by(Watchlist.last_update.desc())  # type: ignore
            result = await session.exec(stmt)
            rows = result.all()

            watchlist_items = []
            for row in rows:
                anime_dict = _row_to_dict(row[0])
                wl: Watchlist = row[1]
                wp_episode_number = row[2]  # actual last-watched episode number (may be None)

                # Use manually-set count first; fall back to actual watch progress episode number
                eps_watched = wl.episodes_watched or 0
                if eps_watched == 0 and wp_episode_number:
                    try:
                        eps_watched = int(wp_episode_number)
                    except (TypeError, ValueError):
                        pass

                eps_total = wl.episodes_total
                progress = 0
                if eps_total and eps_total > 0 and eps_watched > 0:
                    progress = round((eps_watched / eps_total) * 100)
                    if progress > 100:
                        progress = 100

                anime_dict["watchlist_status"] = wl.status
                anime_dict["episodes_watched"] = eps_watched
                anime_dict["episodes_total"] = eps_total
                anime_dict["progress"] = progress
                anime_dict["notes"] = wl.notes
                anime_dict["added_at"] = wl.added_at
                anime_dict["last_update"] = wl.last_update
                anime_dict["completed_at"] = wl.completed_at
                watchlist_items.append(anime_dict)
            return watchlist_items


    async def get_watchlist_stats(self, session_id: str) -> dict:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            # Fetch watchlist with actual episode progress (same join as get_watchlist)
            stmt = (
                select(
                    Watchlist,
                    Episode.episode.label("wp_episode_number"),  # type: ignore
                )
                .outerjoin(
                    WatchProgress,
                    (WatchProgress.anime_id == Watchlist.anime_id) & (WatchProgress.session_id == session_id),  # type: ignore
                )
                .outerjoin(Episode, Episode.id == WatchProgress.episode_id)  # type: ignore
                .where(Watchlist.session_id == session_id)  # type: ignore
            )
            result = await session.exec(stmt)
            rows = result.all()

            totale = len(rows)
            completati = 0
            in_visione = 0
            da_guardare = 0
            in_pausa = 0
            abbandonati = 0
            total_progress_sum = 0.0  # sum of individual progress fractions (0.0–1.0)

            for row in rows:
                wl: Watchlist = row[0]
                wp_ep_num = row[1]

                if wl.status == "completato":
                    completati += 1
                elif wl.status == "in_visione":
                    in_visione += 1
                elif wl.status == "da_guardare":
                    da_guardare += 1
                elif wl.status == "in_pausa":
                    in_pausa += 1
                elif wl.status == "abbandonato":
                    abbandonati += 1

                # Compute fraction for global progress
                if wl.status == "completato":
                    total_progress_sum += 1.0
                else:
                    eps_watched = wl.episodes_watched or 0
                    if eps_watched == 0 and wp_ep_num:
                        try:
                            eps_watched = int(wp_ep_num)
                        except (TypeError, ValueError):
                            pass
                    eps_total = wl.episodes_total
                    if eps_total and eps_total > 0 and eps_watched > 0:
                        total_progress_sum += min(1.0, eps_watched / eps_total)

            global_pct = round((total_progress_sum / totale) * 100) if totale > 0 else 0
            return {
                "totale": totale,
                "completati": completati,
                "in_visione": in_visione,
                "da_guardare": da_guardare,
                "in_pausa": in_pausa,
                "abbandonati": abbandonati,
                "completamento_globale": global_pct,
            }

    # ----- Recommendations -----
    async def get_recommendations(self, session_id: str, limit: int = 12) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            # 1. Recupera tutti gli anime interagiti dall'utente
            interacted_anime_ids = set()
            
            # Watchlist
            wl_stmt = select(Watchlist.anime_id).where(Watchlist.session_id == session_id)
            wl_res = await session.exec(wl_stmt)
            interacted_anime_ids.update(wl_res.all())
            
            # Favorites
            fav_stmt = select(Favorite.anime_id).where(Favorite.session_id == session_id)
            fav_res = await session.exec(fav_stmt)
            interacted_anime_ids.update(fav_res.all())
            
            # WatchProgress
            wp_stmt = select(WatchProgress.anime_id).where(WatchProgress.session_id == session_id)
            wp_res = await session.exec(wp_stmt)
            interacted_anime_ids.update(wp_res.all())

            # Se non ha storico, restituiamo i titoli più votati (Cold Start)
            if not interacted_anime_ids:
                stmt = select(Anime).where(Anime.rating.isnot(None)).order_by(Anime.rating.desc()).limit(limit)  # type: ignore
                result = await session.exec(stmt)
                return [_row_to_dict(r) for r in result.all()]

            # 2. Ottieni i generi degli anime interagiti
            anime_stmt = select(Anime.genres).where(col(Anime.id).in_(interacted_anime_ids))
            anime_res = await session.exec(anime_stmt)
            
            from collections import Counter
            genre_counts = Counter()
            for genres_str in anime_res.all():
                genres = _parse_genres(genres_str)
                for g in genres:
                    genre_counts[g] += 1
            
            # 3. Estrai i top 3 generi
            top_genres = [g for g, count in genre_counts.most_common(3)]
            
            # Se per qualche motivo non ci sono generi, fallback
            if not top_genres:
                stmt = select(Anime).where(col(Anime.id).not_in(interacted_anime_ids)).order_by(Anime.rating.desc()).limit(limit)  # type: ignore
                result = await session.exec(stmt)
                return [_row_to_dict(r) for r in result.all()]

            # 4. Trova raccomandazioni: anime che contengono uno dei top generi, non visti
            # Poiché genres è un JSON/string, facciamo query in memoria se non c'è supporto JSON nativo, oppure filtri stringa
            # SQLite e PostgreSQL differiscono. Per robustezza, estraiamo un batch generoso escludendo i visti e filtriamo in Python.
            # Ottimizzazione: ordiniamo per rating nel DB e poi filtriamo.
            stmt = select(Anime).where(col(Anime.id).not_in(interacted_anime_ids)).where(Anime.rating.isnot(None)).order_by(Anime.rating.desc()).limit(200)  # type: ignore
            result = await session.exec(stmt)
            all_candidates = result.all()
            
            recommendations = []
            for anime in all_candidates:
                a_genres = _parse_genres(anime.genres)
                if any(g in a_genres for g in top_genres):
                    recommendations.append(_row_to_dict(anime))
                    if len(recommendations) >= limit:
                        break
                        
            # Se le raccomandazioni trovate sono troppo poche, riempi con i best rated
            if len(recommendations) < limit:
                seen_recs = {r["id"] for r in recommendations}
                for anime in all_candidates:
                    if anime.id not in seen_recs:
                        recommendations.append(_row_to_dict(anime))
                        if len(recommendations) >= limit:
                            break

            return recommendations

    # ----- Notifications -----
    async def create_notification(self, user_id: str, anime_id: str, episode_id: str, message: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            notif = Notification(
                user_id=user_id,
                anime_id=anime_id,
                episode_id=episode_id,
                message=message
            )
            session.add(notif)
            await session.commit()

    async def get_notifications(self, user_id: str) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()) # type: ignore
            result = await session.exec(stmt)
            return [_row_to_dict(n) for n in result.all()]

    async def mark_notifications_as_read(self, user_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
            result = await session.exec(stmt)
            for notif in result.all():
                notif.is_read = True
                session.add(notif)
            await session.commit()

class MangaDatabase:
    def __init__(self):
        self._initialized = False

    async def _ensure_init(self) -> None:
        """Lazy init: create tables on first async call."""
        if self._initialized:
            return
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self._initialized = True

    async def count(self) -> int:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(func.count()).select_from(Manga))
            return result.one()

    # ----- Manga -----
    async def add_batch(self, manga_list: List[Dict], mode: str = "replace") -> None:
        await self._ensure_init()
        if not manga_list:
            return

        rows = [
            {
                "id": m.get("id"),
                "title": m.get("title", ""),
                "url": m.get("url", ""),
                "image": m.get("image", ""),
                "type": m.get("type", ""),
                "status": m.get("status", ""),
                "year": m.get("year", ""),
                "rating": m.get("rating", ""),
                "genres": _serialize_genres(m.get("genres", [])),
            }
            for m in manga_list
            if m.get("id")
        ]
        if not rows:
            return

        seen_ids = set()
        deduped_rows = []
        for r in rows:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                deduped_rows.append(r)
        rows = deduped_rows

        async with engine.begin() as conn:
            dialect_name = engine.dialect.name
            if dialect_name == "postgresql":
                stmt = pg_insert(Manga).values(rows)
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
                stmt = sqlite_insert(Manga).values(rows)
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

    async def get_by_id(self, manga_id: str) -> Optional[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Manga).where(Manga.id == manga_id))
            manga = result.one_or_none()
            return _row_to_dict(manga) if manga else None

    async def get_all_genres(self) -> List[str]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Manga.genres))
            all_genres = set()
            for g in result.all():
                all_genres.update(_parse_genres(g))
            return sorted(all_genres)

    async def get_all(
        self,
        page: int = 0,
        per_page: int = 50,
        sort_by: str = "title",
        genre: str = "",
        status: str = "",
        search: str = "",
    ) -> dict:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = select(Manga)
            if search:
                stmt = stmt.where(func.lower(Manga.title).like(func.lower(f"%{search}%")))
            if genre:
                stmt = stmt.where(Manga.genres.like(f'%"{genre}"%'))  # type: ignore
            if status:
                stmt = stmt.where(Manga.status == status)
                
            if sort_by == "title":
                stmt = stmt.order_by(Manga.title.asc())  # type: ignore
            elif sort_by == "year":
                stmt = stmt.order_by(Manga.year.desc())  # type: ignore
            
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total_res = await session.exec(count_stmt)
            total = total_res.one()
            
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

    # ----- Chapters -----
    async def add_chapters(self, chapters: List[Dict]) -> None:
        await self._ensure_init()
        if not chapters:
            return

        def _to_float(value):
            if value is None: return None
            try: return float(value)
            except: return None
            
        def _to_int(value):
            if value is None: return None
            try: return int(value)
            except: return None

        rows = [
            {
                "id": ch.get("id"),
                "manga_id": ch.get("manga_id"),
                "title": ch.get("title", ""),
                "url": ch.get("url", ""),
                "volume": _to_int(ch.get("volume")),
                "chapter": _to_float(ch.get("chapter") or ch.get("number")),
                "added_at": ch.get("added_at"),
            }
            for ch in chapters
            if ch.get("id") and ch.get("manga_id")
        ]
        if not rows:
            return

        seen_ids = set()
        deduped_rows = []
        for r in rows:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                deduped_rows.append(r)
        rows = deduped_rows

        async with engine.begin() as conn:
            dialect_name = engine.dialect.name
            if dialect_name == "postgresql":
                stmt = pg_insert(Chapter).values(rows).on_conflict_do_nothing(index_elements=["id"])
            else:
                stmt = sqlite_insert(Chapter).values(rows).on_conflict_do_nothing(index_elements=["id"])
            await conn.execute(stmt)

    async def get_recent_chapters(self, limit: int = 20) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Chapter, Manga.title.label("manga_title"), Manga.image.label("manga_image"))  # type: ignore
                .join(Manga, Chapter.manga_id == Manga.id)  # type: ignore
                .order_by(Chapter.added_at.desc())  # type: ignore
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            chapters = []
            for row in rows:
                if hasattr(row, '_asdict'):
                    chapters.append(row._asdict())
                elif isinstance(row, tuple) and len(row) >= 1:
                    obj = row[0]
                    ch = obj.model_dump()
                    if len(row) > 1:
                        ch["manga_title"] = row[1]
                    if len(row) > 2:
                        ch["manga_image"] = row[2]
                    chapters.append(ch)
            return chapters

    # ----- Watch Progress (Reading) -----
    async def save_progress(self, session_id: str, manga_id: str, chapter_id: str) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(MangaProgress).where(MangaProgress.manga_id == manga_id, MangaProgress.session_id == session_id))  # type: ignore
            wp = result.one_or_none()
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if wp:
                wp.chapter_id = chapter_id
                wp.updated_at = now_str
            else:
                wp = MangaProgress(session_id=session_id, manga_id=manga_id, chapter_id=chapter_id, updated_at=now_str)
                session.add(wp)
            await session.commit()

    async def get_progress(self, session_id: str, manga_id: str) -> Optional[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(MangaProgress).where(MangaProgress.manga_id == manga_id, MangaProgress.session_id == session_id))  # type: ignore
            wp = result.one_or_none()
            if wp:
                return {"chapter_id": wp.chapter_id, "updated_at": wp.updated_at}
            return None

    async def delete_progress(self, session_id: str, manga_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(MangaProgress).where(MangaProgress.manga_id == manga_id, MangaProgress.session_id == session_id))  # type: ignore
            await session.commit()

    async def get_recent_progress(self, session_id: str, limit: int = 10) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(MangaProgress, Manga.title.label("manga_title"), Manga.image.label("manga_image"), Chapter.chapter.label("chapter_number"))  # type: ignore
                .outerjoin(Manga, MangaProgress.manga_id == Manga.id)  # type: ignore
                .outerjoin(Chapter, MangaProgress.chapter_id == Chapter.id)  # type: ignore
                .where(MangaProgress.session_id == session_id)  # type: ignore
                .order_by(MangaProgress.updated_at.desc())  # type: ignore
                .limit(limit)
            )
            result = await session.exec(stmt)
            rows = result.all()
            progresses = []
            for row in rows:
                wp_obj = row[0]
                wp_dict = wp_obj.model_dump()
                wp_dict["manga_title"] = row[1] or f"Manga {wp_obj.manga_id}"
                wp_dict["manga_image"] = row[2] or ""
                wp_dict["chapter_number"] = row[3] or "?"
                progresses.append(wp_dict)
            return progresses

    # ----- Favorites -----
    async def save_favorite(self, session_id: str, manga_id: str) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(MangaFavorite).where(MangaFavorite.manga_id == manga_id, MangaFavorite.session_id == session_id))  # type: ignore
            fav = result.one_or_none()
            if not fav:
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                fav = MangaFavorite(session_id=session_id, manga_id=manga_id, added_at=now_str)
                session.add(fav)
                await session.commit()

    async def remove_favorite(self, session_id: str, manga_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(MangaFavorite).where(MangaFavorite.manga_id == manga_id, MangaFavorite.session_id == session_id))  # type: ignore
            await session.commit()

    async def get_favorites(self, session_id: str) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Manga)
                .join(MangaFavorite, MangaFavorite.manga_id == Manga.id)  # type: ignore
                .where(MangaFavorite.session_id == session_id)  # type: ignore
                .order_by(MangaFavorite.added_at.desc())  # type: ignore
            )
            result = await session.exec(stmt)
            return [_row_to_dict(r) for r in result.all()]

    # ----- Watchlist -----
    async def save_watchlist(
        self,
        session_id: str,
        manga_id: str,
        status: str = "da_leggere",
        chapters_read: Optional[int] = None,
        chapters_total: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> None:
        import datetime
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            result = await session.exec(select(MangaWatchlist).where(MangaWatchlist.manga_id == manga_id, MangaWatchlist.session_id == session_id))  # type: ignore
            item = result.one_or_none()
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if item:
                item.status = status
                item.last_update = now_str
                if chapters_read is not None:
                    item.chapters_read = chapters_read
                if chapters_total is not None:
                    item.chapters_total = chapters_total
                if notes is not None:
                    item.notes = notes
                if status == "completato" and not item.completed_at:
                    item.completed_at = now_str
                elif status != "completato":
                    item.completed_at = None
            else:
                item = MangaWatchlist(
                    session_id=session_id,
                    manga_id=manga_id,
                    status=status,
                    chapters_read=chapters_read or 0,
                    chapters_total=chapters_total,
                    notes=notes,
                    added_at=now_str,
                    last_update=now_str,
                    completed_at=now_str if status == "completato" else None,
                )
                session.add(item)
            await session.commit()

    async def get_watchlist(self, session_id: str, status_filter: Optional[str] = None) -> List[dict]:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            stmt = (
                select(Manga, MangaWatchlist)
                .join(MangaWatchlist, MangaWatchlist.manga_id == Manga.id)  # type: ignore
                .where(MangaWatchlist.session_id == session_id)  # type: ignore
            )
            if status_filter:
                stmt = stmt.where(MangaWatchlist.status == status_filter)
            stmt = stmt.order_by(MangaWatchlist.last_update.desc())  # type: ignore
            result = await session.exec(stmt)
            
            watchlist_items = []
            for row in result.all():
                manga_dict = _row_to_dict(row[0])
                wl: MangaWatchlist = row[1]
                
                manga_dict["watchlist_status"] = wl.status
                manga_dict["chapters_read"] = wl.chapters_read or 0
                manga_dict["chapters_total"] = wl.chapters_total
                manga_dict["notes"] = wl.notes
                manga_dict["added_at"] = wl.added_at
                manga_dict["last_update"] = wl.last_update
                watchlist_items.append(manga_dict)
            return watchlist_items

    async def remove_watchlist(self, session_id: str, manga_id: str) -> None:
        await self._ensure_init()
        async with AsyncSession(engine) as session:
            await session.exec(delete(MangaWatchlist).where(MangaWatchlist.manga_id == manga_id, MangaWatchlist.session_id == session_id))  # type: ignore
            await session.commit()

