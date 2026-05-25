"""
Cache in-memoria per la lista anime con ricerca fuzzy migliorata.
Supporta generi, stato, anno, rating per ogni anime.
"""

import re
import logging
from typing import Optional
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _fuzzy_score(query: str, title: str) -> float:
    q, t = _normalize(query), _normalize(title)
    if not q or not t:
        return 0.0
    if q == t:
        return 1.0
    if t.startswith(q):
        return 0.95
    if q in t:
        return 0.85 + (len(q) / len(t)) * 0.1  # Longer matches score higher
    # Check if all words in query are in title
    q_words = q.split()
    if all(w in t for w in q_words):
        return 0.75 + (len(q) / len(t)) * 0.1
    # Check word-by-word partial match
    t_words = t.split()
    matched = sum(1 for qw in q_words if any(qw in tw or tw.startswith(qw) for tw in t_words))
    if matched == len(q_words):
        return 0.70
    if matched > 0:
        return 0.50 + (matched / len(q_words)) * 0.2
    return SequenceMatcher(None, q, t).ratio()


class AnimeCache:
    def __init__(self):
        self._data: list[dict] = []
        self._id_index: dict[str, dict] = {}

    def add_batch(self, anime_list: list[dict]) -> None:
        for anime in anime_list:
            aid = anime.get("id")
            if aid and aid not in self._id_index:
                self._data.append(anime)
                self._id_index[aid] = anime

    def get_by_id(self, anime_id: str) -> Optional[dict]:
        return self._id_index.get(anime_id)

    def count(self) -> int:
        return len(self._data)

    def clear(self) -> None:
        self._data.clear()
        self._id_index.clear()

    def search(self, query: str, limit: int = 20) -> list[dict]:
        """Search anime with fuzzy matching, sorted by relevance."""
        scored = []
        for anime in self._data:
            score = _fuzzy_score(query, anime.get("title", ""))
            if score >= 0.3:
                scored.append((score, anime))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [a for _, a in scored[:limit]]

    def get_all(self, page: int = 0, per_page: int = 50, sort_by: str = "title",
                genre: str = "", status: str = "", year: str = "", search: str = "") -> dict:
        """Get paginated list of all anime with optional filters."""
        filtered = self._data

        # Apply search filter
        if search:
            search_lower = _normalize(search)
            filtered = [
                a for a in filtered
                if search_lower in _normalize(a.get("title", ""))
            ]

        # Apply genre filter
        if genre:
            genre_lower = genre.lower()
            filtered = [
                a for a in filtered
                if any(genre_lower in g.lower() for g in a.get("genres", []))
            ]

        # Apply status filter
        if status:
            status_lower = status.lower()
            filtered = [
                a for a in filtered
                if status_lower in a.get("status", "").lower()
            ]

        # Apply year filter
        if year:
            filtered = [
                a for a in filtered
                if a.get("year", "") == year
            ]

        # Sort
        if sort_by == "title":
            filtered = sorted(filtered, key=lambda a: a.get("title", "").lower())
        elif sort_by == "year":
            filtered = sorted(filtered, key=lambda a: a.get("year", ""), reverse=True)
        elif sort_by == "rating":
            filtered = sorted(
                filtered,
                key=lambda a: float(a.get("rating", "0") or "0"),
                reverse=True
            )

        total = len(filtered)
        start = page * per_page
        end = start + per_page
        page_data = filtered[start:end]

        return {
            "items": page_data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0,
        }

    def get_all_genres(self) -> list[str]:
        """Get all unique genres."""
        genres = set()
        for a in self._data:
            for g in a.get("genres", []):
                if g:
                    genres.add(g)
        return sorted(genres)

    def get_all_years(self) -> list[str]:
        """Get all unique years."""
        years = set()
        for a in self._data:
            y = a.get("year", "")
            if y:
                years.add(y)
        return sorted(years, reverse=True)

    def get_all_statuses(self) -> list[str]:
        """Get all unique statuses."""
        statuses = set()
        for a in self._data:
            s = a.get("status", "")
            if s:
                statuses.add(s)
        return sorted(statuses)
