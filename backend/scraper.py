"""
AnimeWorld Scraper — BeautifulSoup + requests
Scrapa tutte le pagine A-Z con paginazione completa.
Estrae metadati (generi, stato, anno) dalla API tooltip.
"""

import re
import time
import logging
import requests
from bs4 import BeautifulSoup
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

AZ_LETTERS = ["0-9"] + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
BASE_URL = "https://www.animeworld.ac"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Referer": "https://www.animeworld.ac/",
}


class AnimeWorldScraper:
    def __init__(self, delay: float = 0.3, timeout: int = 15):
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def _fetch(self, url: str, retries: int = 3) -> Optional[BeautifulSoup]:
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(url, timeout=self.timeout)
                resp.raise_for_status()
                return BeautifulSoup(resp.text, "html.parser")
            except requests.exceptions.HTTPError as e:
                resp = e.response
                code = resp.status_code if resp is not None else 500
                if code == 403:
                    logger.warning(f"403 su {url}")
                    return None
                logger.warning(f"HTTP {code} su {url} (tentativo {attempt})")
            except requests.exceptions.RequestException as e:
                logger.warning(f"Errore rete (tentativo {attempt}): {e}")
                if attempt < retries:
                    time.sleep(self.delay * attempt)
        return None

    def _fetch_json(self, url: str, retries: int = 2) -> Optional[dict]:
        """Fetch JSON from API endpoint."""
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(
                    url,
                    timeout=self.timeout,
                    headers={
                        **HEADERS,
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                return resp.json()
            except Exception:
                if attempt < retries:
                    time.sleep(self.delay * attempt)
        return None

    def _fetch_text(self, url: str, retries: int = 2) -> Optional[str]:
        """Fetch raw text."""
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(url, timeout=self.timeout)
                resp.raise_for_status()
                return resp.text
            except Exception:
                if attempt < retries:
                    time.sleep(self.delay * attempt)
        return None

    @staticmethod
    def _extract_id(href: str) -> Optional[str]:
        """Extract anime ID from href like /play/slug.ANIME_ID"""
        match = re.search(r"\.([A-Za-z0-9_-]+)(?:/|$)", href)
        return match.group(1) if match else None

    def _fetch_tooltip(self, tooltip_url: str) -> dict:
        """Fetch metadata from tooltip API: genres, status, year, rating."""
        meta = {"genres": [], "status": "", "year": "", "rating": ""}
        text = self._fetch_text(f"{BASE_URL}{tooltip_url}")
        if not text:
            return meta

        soup = BeautifulSoup(text, "html.parser")
        for div in soup.find_all("div", class_="meta"):
            label_el = div.find("label")
            if not label_el:
                continue
            label = label_el.get_text(strip=True).lower()

            if "genere" in label or "genre" in label:
                genre_links = div.find_all("a")
                if genre_links:
                    meta["genres"] = [a.get_text(strip=True) for a in genre_links]
                else:
                    span = div.find("span")
                    if span:
                        meta["genres"] = [g.strip() for g in span.get_text().split(",") if g.strip()]

            elif "stato" in label or "status" in label:
                span = div.find("span")
                if span:
                    meta["status"] = span.get_text(strip=True)

            elif "data" in label and "uscita" in label:
                span = div.find("span")
                if span:
                    date_text = span.get_text(strip=True)
                    # Extract year from date
                    year_match = re.search(r"\b(19|20)\d{2}\b", date_text)
                    if year_match:
                        meta["year"] = year_match.group(0)

            elif "voto" in label or "rating" in label:
                span = div.find("span")
                if span:
                    meta["rating"] = span.get_text(strip=True)

        return meta

    def _parse_az_page(self, soup: BeautifulSoup, seen: set) -> list[dict]:
        """Parse anime items from an AZ-list page using the correct div.az-list structure."""
        results = []
        az_list = soup.find("div", class_="az-list")
        if not az_list:
            # Fallback: try items div
            az_list = soup.find("div", class_="items")
        if not az_list:
            return results

        items = az_list.find_all("div", class_="item")
        for item in items:
            # Extract thumbnail link and image
            thumb_link = item.find("a", class_="thumb")
            if not thumb_link:
                continue
            href = thumb_link.get("href", "")
            if not href.startswith("/play/"):
                continue

            anime_id = self._extract_id(href)
            if not anime_id or anime_id in seen:
                continue
            seen.add(anime_id)

            # Get image
            img = thumb_link.find("img")
            image = ""
            if img:
                image = img.get("src") or img.get("data-src") or ""
            if not image:
                image = f"https://img.animeworld.ac/locandine/{anime_id}.jpg"

            # Get title from a.name
            name_link = item.find("a", class_="name")
            title = name_link.get_text(strip=True) if name_link else ""
            if not title:
                title = img.get("alt", "") if img else ""
            if not title:
                continue

            # Get tooltip API path for metadata
            tooltip_url = thumb_link.get("data-tip", "")

            # Get release date from data-tippy-content on name link
            release_date = ""
            if name_link:
                release_date = name_link.get("data-tippy-content", "")

            # Extract year from release date
            year = ""
            if release_date:
                year_match = re.search(r"\b(19|20)\d{2}\b", release_date)
                if year_match:
                    year = year_match.group(0)

            results.append({
                "id": anime_id,
                "title": title,
                "url": f"{BASE_URL}{href}",
                "image": image,
                "type": "",
                "genres": [],
                "status": "",
                "year": year,
                "rating": "",
                "_tooltip_url": tooltip_url,
            })

        return results

    def _enrich_with_tooltips(self, anime_list: list[dict], max_workers: int = 5) -> None:
        """Enrich anime list with tooltip metadata (genres, status, year, rating) in parallel."""
        to_enrich = [a for a in anime_list if a.get("_tooltip_url")]
        if not to_enrich:
            return

        def fetch_and_apply(anime):
            tooltip_url = anime.pop("_tooltip_url", "")
            if tooltip_url:
                meta = self._fetch_tooltip(tooltip_url)
                anime["genres"] = meta.get("genres", [])
                anime["status"] = meta.get("status", "")
                if not anime.get("year"):
                    anime["year"] = meta.get("year", "")
                anime["rating"] = meta.get("rating", "")
                time.sleep(0.1)  # Be gentle

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(fetch_and_apply, a) for a in to_enrich]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    logger.warning(f"Tooltip error: {e}")

        # Clean up _tooltip_url from non-enriched items
        for a in anime_list:
            a.pop("_tooltip_url", None)

    def _scrape_az_letter(self, letter: str) -> list[dict]:
        """Scrape ALL pages of a letter in the AZ list."""
        all_results = []
        seen = set()
        page = 1
        max_pages = 100  # Safety limit

        while page <= max_pages:
            url = f"{BASE_URL}/az-list/{letter}?page={page}"
            soup = self._fetch(url)
            if not soup:
                break

            page_results = self._parse_az_page(soup, seen)
            if not page_results:
                # If no new items are found, we reached the end or wrapped around to page 1
                break
            all_results.extend(page_results)

            page += 1
            time.sleep(self.delay)

        logger.info(f"  {letter}: {len(all_results)} anime ({page - 1} pagine)")
        return all_results


    def build_full_index(self, cache, batch_mode="replace") -> None:
        """Build the full anime index from A-Z list pages, with tooltip metadata."""
        logger.info(f"Inizio scraping {len(AZ_LETTERS)} sezioni A-Z...")
        total = 0
        for letter in AZ_LETTERS:
            items = self._scrape_az_letter(letter)
            if items:
                # Enrich with tooltip metadata (genres, status, year, rating)
                logger.info(f"  {letter}: arricchimento metadati per {len(items)} anime...")
                self._enrich_with_tooltips(items)
                cache.add_batch(items, mode=batch_mode)
                total += len(items)
            time.sleep(self.delay)
        logger.info(f"Indicizzazione completata: {total} anime totali")

    def get_anime_detail(self, anime_url: str) -> dict:
        """Get full anime detail from anime page (episodes, description, genres etc)."""
        soup = self._fetch(anime_url)
        if not soup:
            return {"episodes": [], "description": "", "genres": []}

        detail = {
            "description": "", "genres": [], "status": "",
            "year": "", "episodes": [], "cover": "", "type": "",
            "rating": "", "studio": "", "season": "",
        }

        # Extract info from dt/dd pairs
        for dt in soup.find_all("dt"):
            label = dt.get_text(strip=True).lower()
            dd = dt.find_next_sibling("dd")
            if not dd:
                continue
            val = dd.get_text(strip=True)
            if "genere" in label or "genre" in label:
                # Get individual genre links
                genre_links = dd.find_all("a")
                if genre_links:
                    detail["genres"] = [a.get_text(strip=True) for a in genre_links]
                else:
                    detail["genres"] = [g.strip() for g in val.split(",") if g.strip()]
            elif "stato" in label or "status" in label:
                detail["status"] = val
            elif "anno" in label or "year" in label:
                detail["year"] = val
            elif "tipo" in label or "type" in label:
                detail["type"] = val
            elif "categoria" in label:
                if not detail["type"]:
                    detail["type"] = val
            elif "studio" in label:
                detail["studio"] = val
            elif "stagione" in label or "season" in label:
                detail["season"] = val

        # Description
        desc = soup.find("div", class_="desc") or soup.find("div", id="desc")
        if desc:
            detail["description"] = desc.get_text(strip=True)

        # Cover image
        cover_el = soup.select_one("#thumbnail-watch img, #mobile-thumbnail-watch img")
        if cover_el:
            src = cover_el.get("src")
            if isinstance(src, str):
                detail["cover"] = src

        # Rating
        rating_div = soup.find("div", class_="rating")
        if rating_div and rating_div.get("data-value"):
            detail["rating"] = rating_div["data-value"]

        # Episodes from active server
        episodes = []
        seen_ep = set()

        # Method 1: div.server.active ul.episodes li a (the correct selector)
        server = soup.find("div", class_="server")
        if server:
            ep_links = server.find_all("a", href=True)
            for ep in ep_links:
                href = ep.get("href", "")
                if not href.startswith("/play/"):
                    continue
                ep_id = href.split("/")[-1]
                if ep_id and ep_id not in seen_ep:
                    seen_ep.add(ep_id)
                    episodes.append({
                        "number": ep.get("data-num") or ep.get_text(strip=True) or str(len(episodes) + 1),
                        "url": f"{BASE_URL}{href}",
                        "id": ep_id,
                    })

        # Method 2: fallback - find by anime slug pattern
        if not episodes:
            slug = anime_url.rstrip("/").split("/")[-1]
            for a in soup.find_all("a", href=re.compile(rf"/play/{re.escape(slug)}/")):
                href = a.get("href", "")
                ep_id = href.split("/")[-1]
                if ep_id and ep_id not in seen_ep:
                    seen_ep.add(ep_id)
                    episodes.append({
                        "number": a.get("data-num") or a.get_text(strip=True) or str(len(episodes) + 1),
                        "url": f"{BASE_URL}{href}",
                        "id": ep_id,
                    })

        detail["episodes"] = episodes
        return detail

    def get_episode_video_url(self, episode_id: str) -> dict:
        """Get the direct video stream URL from the episode info API."""
        result = {"video_url": "", "error": ""}
        try:
            data = self._fetch_json(f"{BASE_URL}/api/episode/info?id={episode_id}")
            if data and "grabber" in data:
                result["video_url"] = data["grabber"]
            else:
                result["error"] = "Impossibile ottenere l'URL del video"
        except Exception as e:
            result["error"] = str(e)
        return result

    def debug_page(self, letter: str) -> dict:
        """Debug: analyze the HTML structure of an AZ page."""
        url = f"{BASE_URL}/az-list/{letter}"
        soup = self._fetch(url)
        if not soup:
            return {"error": "Fetch failed"}

        az_list = soup.find("div", class_="az-list")
        items = az_list.find_all("div", class_="item") if az_list else []

        result = {
            "url": url,
            "az_list_found": az_list is not None,
            "total_items": len(items),
            "items": [],
        }
        for item in items[:5]:
            thumb = item.find("a", class_="thumb")
            name = item.find("a", class_="name")
            img = thumb.find("img") if thumb else None
            result["items"].append({
                "href": thumb.get("href") if thumb else None,
                "tooltip": thumb.get("data-tip") if thumb else None,
                "title": name.get_text(strip=True) if name else None,
                "image": img.get("src") if img else None,
            })

        return result

    def scrape_latest_updates(self, db) -> None:
        """Scrape the latest updates page and add/update them in the DB."""
        logger.info("Avvio scraping nuovi episodi...")
        url = f"{BASE_URL}/updated"
        soup = self._fetch(url)
        if not soup:
            logger.warning("Scraping nuovi episodi fallito: nessuna risposta.")
            return

        # /updated page uses the same .item layout as the A-Z list
        items = soup.select(".item")
        if not items:
            logger.warning("Nessun anime trovato nella pagina /updated.")
            return

        anime_list = []
        for div in items:
            thumb = div.find("a", class_="thumb")
            if not thumb:
                continue

            href = thumb.get("href", "")
            if not href.startswith("play/"):
                continue

            aid = href.split(".")[-1] if "." in href else ""
            if not aid:
                continue

            title = ""
            name_a = div.find("a", class_="name")
            if name_a:
                title = name_a.get_text(strip=True)

            img_tag = div.find("img")
            img_url = img_tag.get("src", "") if img_tag else ""
            tooltip_url = thumb.get("data-tip", "")

            anime_list.append({
                "id": aid,
                "title": title,
                "url": f"{BASE_URL}/{href.lstrip('/')}",
                "image": img_url,
                "type": "",
                "genres": [],
                "status": "",
                "year": "",
                "rating": "",
                "_tooltip_url": tooltip_url,
            })

        logger.info(f"Trovati {len(anime_list)} anime aggiornati. Arricchimento metadati in corso...")
        self._enrich_with_tooltips(anime_list, max_workers=5)
        
        # Save to DB
        db.add_batch(anime_list)
        logger.info("Database aggiornato con i nuovi episodi con successo.")
        # Fetch and store episodes for each updated anime
        for anime in anime_list:
            try:
                url = anime.get("url")
                if isinstance(url, str):
                    detail = self.get_anime_detail(url)
                    episodes = detail.get("episodes", [])
                    # Attach anime_id to each episode
                    for ep in episodes:
                        ep["anime_id"] = anime["id"]
                    if episodes:
                        db.add_episodes(episodes)
            except Exception as e:
                logger.warning(f"Failed to fetch episodes for {anime.get('id')}: {e}")