import sqlite3
import json
import os
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "anisearch.db")


class AnimeDatabase:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS anime (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    image TEXT,
                    type TEXT,
                    status TEXT,
                    year TEXT,
                    rating TEXT,
                    genres TEXT
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_title ON anime(title)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_year ON anime(year)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_status ON anime(status)")
            # New table for episodes
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS episodes (
                    id TEXT PRIMARY KEY,
                    anime_id TEXT NOT NULL,
                    title TEXT,
                    url TEXT,
                    season INTEGER,
                    episode INTEGER,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(anime_id) REFERENCES anime(id)
                )
            """)
            # Table for watch progress (last viewed episode per anime)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS watch_progress (
                    anime_id TEXT PRIMARY KEY,
                    episode_id TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(anime_id) REFERENCES anime(id),
                    FOREIGN KEY(episode_id) REFERENCES episodes(id)
                )
            """)
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        if d.get("genres"):
            try:
                d["genres"] = json.loads(d["genres"])
            except:
                d["genres"] = []
        else:
            d["genres"] = []
        return d

    def add_batch(self, anime_list: List[Dict]) -> None:
        if not anime_list:
            return
            
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for a in anime_list:
                genres_json = json.dumps(a.get("genres", []))
                cursor.execute("""
                    INSERT OR REPLACE INTO anime 
                    (id, title, url, image, type, status, year, rating, genres)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    a.get("id"),
                    a.get("title", ""),
                    a.get("url", ""),
                    a.get("image", ""),
                    a.get("type", ""),
                    a.get("status", ""),
                    a.get("year", ""),
                    a.get("rating", ""),
                    genres_json
                ))
            conn.commit()

    def get_by_id(self, anime_id: str) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM anime WHERE id = ?", (anime_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None

    def get_all_genres(self) -> List[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT genres FROM anime WHERE genres IS NOT NULL")
            all_genres = set()
            for (g_str,) in cursor.fetchall():
                if g_str:
                    try:
                        g_list = json.loads(g_str)
                        all_genres.update(g_list)
                    except:
                        pass
            return sorted(all_genres)

    def get_all_years(self) -> List[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT year FROM anime WHERE year IS NOT NULL AND year != ''")
            years = [row[0] for row in cursor.fetchall()]
            return sorted(years, reverse=True)

    def get_all_statuses(self) -> List[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT status FROM anime WHERE status IS NOT NULL AND status != ''")
            statuses = [row[0] for row in cursor.fetchall()]
            return sorted(statuses)

    def search_exact_or_fuzzy_fallback(self, query: str, limit: int = 20) -> List[Dict]:
        # For a truly robust fuzzy search in SQLite without FTS5, we will fetch titles
        # and do a quick Python-side filter. It's perfectly fine for < 50k rows.
        # But first, we try a simple LIKE.
        q = f"%{query}%"
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM anime WHERE title LIKE ? LIMIT ?", (q, limit))
            rows = cursor.fetchall()
            return [self._row_to_dict(r) for r in rows]

    def get_all(self, page: int = 0, per_page: int = 50, sort_by: str = "title",
                genre: str = "", status: str = "", year: str = "", search: str = "") -> dict:
        
        query = "SELECT * FROM anime WHERE 1=1"
        count_query = "SELECT COUNT(*) FROM anime WHERE 1=1"
        params = []
        
        if search:
            query += " AND title LIKE ?"
            count_query += " AND title LIKE ?"
            params.append(f"%{search}%")
            
        if genre:
            query += " AND genres LIKE ?"
            count_query += " AND genres LIKE ?"
            # JSON array contains the genre
            params.append(f'%"{genre}"%')
            
        if status:
            query += " AND status = ?"
            count_query += " AND status = ?"
            params.append(status)
            
        if year:
            query += " AND year = ?"
            count_query += " AND year = ?"
            params.append(year)
            
        # Sorting
        if sort_by == "title":
            query += " ORDER BY title ASC"
        elif sort_by == "year":
            query += " ORDER BY year DESC"
        elif sort_by == "rating":
            # Cast rating to float for correct sorting
            query += " ORDER BY CAST(rating AS FLOAT) DESC"
            
        # Pagination
        query += f" LIMIT {per_page} OFFSET {page * per_page}"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get total count
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get data
            cursor.execute(query, params)
            rows = cursor.fetchall()
            items = [self._row_to_dict(r) for r in rows]
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0,
        }

    def count(self) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM anime")
            return cursor.fetchone()[0]

    def clear(self) -> None:
        """Delete all data from anime, episodes, and watch_progress tables."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM watch_progress")
            cursor.execute("DELETE FROM episodes")
            cursor.execute("DELETE FROM anime")
            conn.commit()
        logger.info("Database cleared — all tables emptied.")

    def add_episodes(self, episodes: List[Dict]) -> None:
        """Insert or update episodes in the episodes table. Uses INSERT OR REPLACE to avoid duplicates."""
        if not episodes:
            return
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for ep in episodes:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO episodes (id, anime_id, title, url, season, episode)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ep.get("id"),
                        ep.get("anime_id"),
                        ep.get("title", ""),
                        ep.get("url", ""),
                        ep.get("season"),
                        ep.get("episode"),
                    ),
                )
            conn.commit()

    def get_recent_episodes(self, limit: int = 20) -> List[Dict]:
        """Return the most recent episodes ordered by added_at descending."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT e.*, a.title as anime_title, a.image as anime_image
                FROM episodes e
                JOIN anime a ON e.anime_id = a.id
                ORDER BY e.added_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                # Parse JSON if needed
                result.append(d)
            return result

    def set_watch_progress(self, anime_id: str, episode_id: str) -> None:
        """Set or update the last watched episode for an anime."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO watch_progress (anime_id, episode_id, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                """,
                (anime_id, episode_id),
            )
            conn.commit()

    def get_watch_progress(self, anime_id: str) -> Optional[Dict]:
        """Retrieve the watch progress for a given anime."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT episode_id, updated_at FROM watch_progress WHERE anime_id = ?",
                (anime_id,),
            )
            row = cursor.fetchone()
            if row:
                return {"episode_id": row["episode_id"], "updated_at": row["updated_at"]}
            return None
