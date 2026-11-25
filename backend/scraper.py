"""
AnimeWorld Scraper — BeautifulSoup + requests
Supporta i domini animeworld.ac (vecchio, contenuto SSR parziale) e
animeworld.or.at (nuovo, Laravel con API AJAX /ajax/anime/search).
Estrae metadati (generi, stato, anno) dalla pagina dettaglio anime.
"""

import re
import time
import asyncio
import logging
import requests
from bs4 import BeautifulSoup
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

# Domini disponibili — usati in ordine di priorità
DOMAINS = [
    "https://www.animeworld.ac",   # primario, struttura stabile
    "https://animeworld.or.at",   # fallback Laravel + AJAX
]

AZ_LETTERS = ["0-9"] + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}
HEADERS_JSON = {
    **HEADERS_BASE,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}


class AnimeWorldScraper:
    def __init__(self, delay: float = 0.3, timeout: tuple = (5, 15)):
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(HEADERS_BASE)
        # Determina automaticamente quale dominio usare
        self.domain = self._detect_domain()
        # In-memory cache for episode extplay links to avoid rate limiting
        # Key format: "{anime_slug}-{episode_id}" to avoid cross-anime collisions
        # (e.g., "ep-1" exists for every anime)
        self._ep_video_cache: dict[str, str] = {}

    def _detect_domain(self) -> str:
        """Tenta ciascun dominio finché uno risponde con contenuto utile."""
        for d in DOMAINS:
            try:
                r = self.session.get(d, timeout=self.timeout, headers={**HEADERS_BASE, "Referer": f"{d}/"})
                if r.status_code == 200 and len(r.text) > 50000:
                    logger.info(f"Dominio rilevato: {d}")
                    return d
            except Exception as e:
                logger.warning(f"Dominio {d} non disponibile: {e}")
        # Fallback al primo dominio
        return DOMAINS[0]

    @property
    def BASE_URL(self) -> str:
        return self.domain

    def close(self):
        """Close the underlying requests Session."""
        if hasattr(self, "session") and self.session:
            self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _fetch(self, url: str, retries: int = 3, allow_redirects: bool = False) -> Optional[BeautifulSoup]:
        """Fetch HTML page. By default does NOT follow redirects to avoid
        hitting episode pages when fetching anime detail pages."""
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(url, timeout=self.timeout, allow_redirects=allow_redirects)

                if resp.status_code == 200:
                    return BeautifulSoup(resp.text, "html.parser")

                # Handle redirect manually only when explicitly allowed
                if allow_redirects and resp.status_code in (301, 302) and resp.headers.get('Location'):
                    redirect_url = resp.headers['Location']
                    if not redirect_url.startswith('http'):
                        redirect_url = f"{self.BASE_URL.rstrip('/')}/{redirect_url.lstrip('/')}"
                    resp = self.session.get(redirect_url, timeout=self.timeout, allow_redirects=False)
                    if resp.status_code == 200:
                        return BeautifulSoup(resp.text, "html.parser")

                if resp.status_code == 403:
                    logger.warning(f"403 su {url}")
                    return None
                logger.warning(f"HTTP {resp.status_code} su {url} (tentativo {attempt})")
                if attempt < retries:
                    time.sleep(self.delay * attempt)
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
                        **HEADERS_BASE,
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.warning(f"Fetch JSON error on attempt {attempt} for {url}: {e}")
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
            except Exception as e:
                logger.warning(f"Fetch text error on attempt {attempt} for {url}: {e}")
                if attempt < retries:
                    time.sleep(self.delay * attempt)
        return None

    @staticmethod
    def _extract_id(href: str) -> Optional[str]:
        """Extract anime ID from href.

        Old .ac format: /play/slug.ANIME_ID  or  /anime/slug.ANIME_ID
        New .or.at format: /anime/slug-ID   or  /watch/slug-ID/ep-NUM  or  /watch/slug-ID/ep-latest
        """
        # Pattern nuovo (.or.at): /anime/slug-ID o /watch/slug-ID/...
        m = re.search(r"/(?:anime|watch)/([A-Za-z0-9_-]+?)-(\w+)(?:/\S*)?$", href)
        if m:
            return f"{m.group(2)}---{m.group(1)}"
        # Pattern vecchio (.ac): /play/slug.ID_NUM
        m2 = re.search(r"\.([A-Za-z0-9_-]+)(?:/|$)", href)
        if m2:
            return m2.group(1)
        return None

    def _parse_anime_from_html(self, html: str) -> list[dict]:
        """Parse anime entries from HTML returned by search or other AJAX endpoints."""
        results = []
        soup = BeautifulSoup(html, "html.parser")
        items = soup.select(".item, article, [class*=anime-item]")
        for item in items:
            thumb_link = item.select_one("a.thumb, a[href*='/anime/'], a[href*='/watch/']")
            if not thumb_link:
                continue
            href = thumb_link.get("href", "")
            if not href:
                continue

            anime_id = self._extract_id(href)
            if not anime_id:
                continue

            img = thumb_link.select_one("img")
            image = ""
            if img:
                image = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
                # Normalize CDN URLs
                if image and "//" in image and not image.startswith("http"):
                    image = "https:" + image

            title_el = item.select_one("a.name, .name, .d-title, h3, h2")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                title = img.get("alt", "") if img else ""
            if not title:
                continue

            # Extract year from data attributes or visible text
            year = ""
            date_attr = thumb_link.get("data-tippy-content", "") or thumb_link.get("data-tip", "")
            if date_attr:
                year_match = re.search(r"\b(19|20)\d{2}\b", date_attr)
                if year_match:
                    year = year_match.group(0)

            results.append({
                "id": anime_id,
                "title": title,
                "url": href if href.startswith("http") else f"{self.BASE_URL}{href}",
                "image": image,
                "type": "",
                "genres": [],
                "status": "",
                "year": year,
                "rating": "",
                "_tooltip_url": thumb_link.get("data-tip", ""),
            })
        return results

    def search(self, keyword: str, limit: int = 20) -> list[dict]:
        """Search for an anime using the AJAX search endpoint.

        Note: The .ac domain doesn't support /ajax/anime/search.
        We always use .or.at for searching since it has the AJAX endpoint.
        """
        # Always use .or.at for AJAX search since .ac doesn't have this endpoint
        url = f"https://animeworld.or.at/ajax/anime/search?keyword={requests.utils.quote(keyword)}"
        data = self._fetch_json(url)
        if not data:
            return []
        html = data.get("result", {}).get("html", "")
        if not html:
            return []
        return self._parse_anime_from_html(html)[:limit]

    def _enrich_with_tooltips(self, anime_list: list[dict], max_workers: int = 5) -> None:
        """Enrich anime list with metadata from tooltip/detail pages."""
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
                time.sleep(0.1)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(fetch_and_apply, a) for a in to_enrich]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    logger.warning(f"Tooltip error: {e}")

        for a in anime_list:
            a.pop("_tooltip_url", None)

    def _fetch_tooltip(self, tooltip_url: str) -> dict:
        """Fetch metadata from tooltip API page."""
        meta = {"genres": [], "status": "", "year": "", "rating": ""}
        clean_path = tooltip_url.lstrip("/")
        url = f"{self.BASE_URL}/{clean_path}"
        text = self._fetch_text(url)
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
                    year_match = re.search(r"\b(19|20)\d{2}\b", date_text)
                    if year_match:
                        meta["year"] = year_match.group(0)

            elif "voto" in label or "rating" in label:
                span = div.find("span")
                if span:
                    meta["rating"] = span.get_text(strip=True)

        return meta

    def _parse_az_page(self, soup: BeautifulSoup, seen: set) -> list[dict]:
        """Parse anime items from an AZ-list page (old .ac style)."""
        results = []
        az_list = soup.find("div", class_="az-list")
        if not az_list:
            az_list = soup.find("div", class_="items")
        if not az_list:
            return results

        items = az_list.find_all("div", class_="item")
        for item in items:
            thumb_link = item.find("a", class_="thumb")
            if not thumb_link:
                continue
            href = thumb_link.get("href", "")
            if not href.startswith("/play/") and "/anime/" not in href and "/watch/" not in href:
                continue

            anime_id = self._extract_id(href)
            if not anime_id or anime_id in seen:
                continue
            seen.add(anime_id)

            img = thumb_link.find("img")
            image = ""
            if img:
                image = img.get("src") or img.get("data-src") or ""
            if not image:
                image = f"https://img.animeworld.ac/locandine/{anime_id}.jpg"

            name_link = item.find("a", class_="name")
            title = name_link.get_text(strip=True) if name_link else ""
            if not title:
                title = img.get("alt", "") if img else ""
            if not title:
                continue

            tooltip_url = thumb_link.get("data-tip", "")
            release_date = ""
            if name_link:
                release_date = name_link.get("data-tippy-content", "")

            year = ""
            if release_date:
                year_match = re.search(r"\b(19|20)\d{2}\b", release_date)
                if year_match:
                    year = year_match.group(0)

            results.append({
                "id": anime_id,
                "title": title,
                "url": href if href.startswith("http") else f"{self.BASE_URL}{href}",
                "image": image,
                "type": "",
                "genres": [],
                "status": "",
                "year": year,
                "rating": "",
                "_tooltip_url": tooltip_url,
            })

        return results

    def _scrape_az_letter(self, letter: str) -> list[dict]:
        """Scrape ALL pages of a letter in the AZ list."""
        all_results = []
        seen = set()
        page = 1
        max_pages = 100

        while page <= max_pages:
            url = f"{self.BASE_URL}/az-list/{letter}?page={page}"
            soup = self._fetch(url)
            if not soup:
                break

            page_results = self._parse_az_page(soup, seen)
            if not page_results:
                break
            all_results.extend(page_results)

            page += 1
            time.sleep(self.delay)

        logger.info(f"  {letter}: {len(all_results)} anime ({page - 1} pagine)")
        return all_results

    def build_full_index(self, cache, batch_mode="replace", loop=None) -> None:
        """Build the full anime index — tries AJAX search per letter first, falls back to A-Z pages."""
        logger.info(f"Inizio indicizzazione anime (dominio: {self.BASE_URL})...")
        total = 0
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()

        # Strategy 1: Try the AJAX search endpoint per letter (works on .or.at)
        ajax_works = False
        test_data = self._fetch_json(f"{self.BASE_URL}/ajax/anime/search?keyword=a")
        if test_data and test_data.get("result", {}).get("html"):
            test_items = self._parse_anime_from_html(test_data["result"]["html"])
            if test_items:
                ajax_works = True
                logger.info("Metodo AJAX search attivo — uso ricerca per lettera.")

        if ajax_works:
            for letter in AZ_LETTERS:
                try:
                    data = self._fetch_json(f"{self.BASE_URL}/ajax/anime/search?keyword={letter}")
                    if not data or not data.get("result", {}).get("html"):
                        continue
                    items = self._parse_anime_from_html(data["result"]["html"])
                    if not items:
                        continue
                    logger.info(f"  {letter}: {len(items)} anime")
                    future = asyncio.run_coroutine_threadsafe(cache.add_batch(items, mode=batch_mode), loop)
                    future.result()
                    total += len(items)
                except Exception as e:
                    logger.warning(f"  {letter}: errore {e}")
                time.sleep(self.delay)
        else:
            # Strategy 2: Fall back to A-Z list pages (old .ac style)
            logger.info("Metodo AJAX non disponibile — fallback a scraping A-Z completo.")
            for letter in AZ_LETTERS:
                items = self._scrape_az_letter(letter)
                if items:
                    logger.info(f"  {letter}: arricchimento metadati per {len(items)} anime...")
                    self._enrich_with_tooltips(items)
                    future = asyncio.run_coroutine_threadsafe(cache.add_batch(items, mode=batch_mode), loop)
                    future.result()
                    total += len(items)
                time.sleep(self.delay)

        logger.info(f"Indicizzazione completata: {total} anime totali")

    def get_anime_detail(self, anime_url: str) -> dict:
        """Get full anime detail from anime page (episodes, description, genres etc)."""
        if not anime_url.startswith("http"):
            anime_url = f"{self.BASE_URL}{anime_url}"

        # Try primary domain first
        soup = self._fetch(anime_url)
        detail = self._parse_detail(soup, anime_url)

        # If too few episodes, try fallback domain (.or.at)
        if len(detail.get("episodes", [])) < 5 and self.BASE_URL != DOMAINS[1]:
            logger.info(f"Few episodes ({len(detail.get('episodes', []))}) on {self.BASE_URL}, trying fallback...")
            fallback_url = anime_url.replace(DOMAINS[0], DOMAINS[1])
            fallback_soup = self._fetch(fallback_url)
            if fallback_soup:
                fallback_detail = self._parse_detail(fallback_soup, fallback_url)
                if len(fallback_detail.get("episodes", [])) > len(detail.get("episodes", [])):
                    logger.info(f"Fallback to {DOMAINS[1]} found more episodes")
                    detail = fallback_detail

        return detail

    def _parse_detail(self, soup, anime_url: str) -> dict:
        """Parse anime detail from BeautifulSoup object."""
        if not soup:
            return {"episodes": [], "description": "", "genres": []}

        detail = {
            "description": "", "genres": [], "status": "",
            "year": "", "episodes": [], "cover": "", "type": "",
            "rating": "", "studio": "", "season": "",
        }

        # New .or.at format: dt/dd pairs
        for dt in soup.find_all("dt"):
            label = dt.get_text(strip=True).lower()
            dd = dt.find_next_sibling("dd")
            if not dd:
                continue
            val = dd.get_text(strip=True)
            if "genere" in label or "genre" in label:
                genre_links = dd.find_all("a")
                if genre_links:
                    detail["genres"] = [a.get_text(strip=True) for a in genre_links]
                else:
                    detail["genres"] = [g.strip() for g in val.split(",") if g.strip()]
            elif "stato" in label or "status" in label:
                detail["status"] = val
            elif "anno" in label or "year" in label:
                m = re.search(r"\d{4}", val)
                detail["year"] = m.group(0) if m else val
            elif "tipo" in label or "type" in label:
                detail["type"] = val
            elif "studio" in label:
                detail["studio"] = val
            elif "stagione" in label or "season" in label:
                detail["season"] = val

        # Description — look for common classes
        desc = soup.select_one("div.desc, div#desc, .anime-description, .synopsis")
        if not desc:
            desc = soup.find("div", string=lambda t: t and ("trama" in t.lower() or "synopsis" in t.lower()))
        if desc:
            texts = [line.strip() for line in desc.get_text("\n").splitlines() if line.strip()]
            detail["description"] = " ".join(texts[1:] if len(texts) > 1 else texts)

        # Cover image
        cover_el = soup.select_one(
            "#thumbnail-watch img, #mobile-thumbnail-watch img, "
            "img[src*='storage/media'], img[src*='cdn']"
        )
        if cover_el:
            src = cover_el.get("src") or cover_el.get("data-src") or ""
            if src:
                if src.startswith("//"):
                    src = "https:" + src
                elif src.startswith("/"):
                    src = self.BASE_URL.rstrip("/") + src
                detail["cover"] = src

        # Rating
        rating_div = soup.select_one(".rating, [class*=rating]")
        if rating_div:
            val = rating_div.get("data-value") or rating_div.get_text(strip=True)
            if val:
                detail["rating"] = val

        # Episodes — new .or.at site uses data-slug attributes on anchor tags
        episodes = []
        seen_ep = set()

        # Get the anime slug from the page URL (e.g., /anime/gintama-shirogane...)
        page_url_match = re.search(r'/anime/([^/]+)', anime_url)
        anime_slug = page_url_match.group(1) if page_url_match else ""
        base_url = self.BASE_URL.rstrip("/")

        # Strategy 1: Parse from data-slug attributes (new .or.at format)
        for a in soup.find_all("a", href=True):
            ep_num = a.get("data-slug", "")
            if not ep_num:
                continue
            ep_num_clean = str(ep_num).strip()
            if ep_num_clean in seen_ep:
                continue
            seen_ep.add(ep_num_clean)

            ep_id = f"ep-{ep_num_clean}"
            # Build episode URL: /watch/{anime_slug}/ep-{number}
            ep_url = f"{base_url}/watch/{anime_slug}/ep-{ep_num_clean}" if anime_slug else ""

            # Cache key includes anime slug to avoid cross-anime collisions
            cache_key = f"{anime_slug or 'unknown'}-{ep_id}" if anime_slug else ep_id
            episodes.append({
                "number": ep_num_clean,
                "url": ep_url,
                "id": ep_id,
                "title": a.get_text(strip=True),
                "video_url": self._ep_video_cache.get(cache_key, ""),
            })

        # If no episodes found, try legacy link parsing as fallback
        if not episodes:
            # Strategy 1: Look for <li><a href="/play/slug.SHORTID" text="EP_NUM"> in .widget-body servers
            ep_from_li = self._parse_ac_episode_list(soup, anime_slug)
            if ep_from_li:
                episodes = ep_from_li

            # Strategy 2: Fallback to old regex pattern (for very old pages)
            if not episodes:
                ep_pattern = re.compile(r"/(?:watch/[^/]+)?/(?:ep-\d+|episode/\d+)")
                for a in soup.find_all("a", href=True):
                    href = a.get("href", "")
                    if not ep_pattern.search(href):
                        continue
                    num_match = re.search(r"(\d+(?:\.\d+)?)", href)
                    ep_num = num_match.group(1) if num_match else str(len(episodes) + 1)
                    ep_id = href.rstrip("/").split("/")[-1].split("?")[0]
                    if ep_id and ep_id not in seen_ep:
                        seen_ep.add(ep_id)
                        ep_title = a.get_text(strip=True)
                        # Cache key includes anime slug to avoid cross-anime collisions
                        cache_key = f"{anime_slug or 'unknown'}-{ep_id}" if anime_slug else ep_id
                        episodes.append({
                            "number": ep_num,
                            "url": href if href.startswith("http") else f"{self.BASE_URL}{href}",
                            "id": ep_id,
                            "title": ep_title,
                            "video_url": self._ep_video_cache.get(cache_key, ""),
                        })

        detail["episodes"] = episodes
        return detail

    def _parse_ac_episode_list(self, soup: BeautifulSoup, anime_slug: str = "") -> list[dict]:
        """Parse episode links from .ac site's <ul> inside .server.active containers.

        New .ac format uses short random IDs (e.g. /play/slug.SHORTID/ABc12) instead of ep-NUMERO.
        Episodes are in <li><a href="/play/...">EP_NUM</a></li> inside server tab lists.
        """
        episodes = []
        seen = set()

        # Find all <ul> inside .widget-body that contain /play/ links
        for ul in soup.find_all("ul"):
            play_links = [
                a for a in ul.find_all("a", href=True)
                if "/play/" in a.get("href", "") and "animeworld.ac/play/" not in a.get("href", "").lower().replace("https://", "") or "/play/" in a.get("href", "")
            ]
            if not play_links or len(play_links) < 5:
                continue

            # Verify parent is a server container
            parent = ul.parent
            if not parent or "server" not in parent.get("class", []):
                continue

            for a in play_links:
                href = a.get("href", "")
                if not href.startswith("/"):
                    continue
                text = a.get_text(strip=True)
                if not text:
                    continue

                # Extract short ID: /play/slug.ID/SHORTID
                m = re.search(r"/play/[^/]+/([^/]+)", href)
                if not m:
                    continue
                short_id = m.group(1)
                if short_id in seen:
                    continue
                seen.add(short_id)

                cache_key = f"{anime_slug or 'unknown'}-ep-{short_id}"
                episodes.append({
                    "number": text,
                    "url": f"{self.BASE_URL}{href}",
                    "id": f"ep-{short_id}",
                    "title": text,
                    "video_url": self._ep_video_cache.get(cache_key, ""),
                })

        return episodes

    def get_episode_video_url(self, episode_id: str, episode_url: str = None, anime_slug: str = None) -> dict:
        """Get the direct MP4 stream URL for an episode.

        Resolution chain:
        1. In-memory cache hit → return immediately (cache key: "{anime_slug}-{episode_id}")
        2. Try .ac API directly (works for legacy short IDs like "ZXFbr")
        3. Fetch episode page via provided episode_url → extract au-extplay-btn → call AC API → MP4
        4. Return empty string on failure
        """
        result = {"video_url": "", "error": ""}

        # 1. Memory cache - use slug-aware key to avoid cross-anime collisions
        # Auto-extract anime slug from episode_url if not provided (e.g., /watch/{slug}/ep-N)
        resolved_slug = anime_slug
        if not resolved_slug and episode_url:
            slug_match = re.search(r'/watch/([^/]+)/ep', episode_url)
            resolved_slug = slug_match.group(1) if slug_match else None
        cache_key = f"{resolved_slug or 'unknown'}-{episode_id}" if resolved_slug else episode_id
        if cache_key in self._ep_video_cache:
            result["video_url"] = self._ep_video_cache[cache_key]
            return result

        # 2. Direct .ac API (legacy short IDs)
        try:
            data = self._fetch_json(f"https://www.animeworld.ac/api/episode/info?id={episode_id}")
            if data and isinstance(data, dict) and data.get("grabber"):
                result["video_url"] = data["grabber"]
                self._ep_video_cache[cache_key] = result["video_url"]
                return result
        except Exception:
            pass

        # 3. Resolve via OR-at episode page (needs full URL with correct anime slug)
        target_url = episode_url
        if not target_url:
            result["error"] = "缺少 episode URL"
            return result

        try:
            r = self.session.get(target_url, timeout=self.timeout)
            if r.status_code != 200:
                result["error"] = f"页面请求失败 ({r.status_code})"
                return result

            text = r.text
            # Match au-extplay-btn links — MUST be animeworld.ac/play (not .or.at)
            all_links = re.findall(
                r'<a\s+class="btn\s+btn-primary\s+au-extplay-btn"[^>]*href=["\']([^"\']+)["\']',
                text, re.I
            )
            if not all_links:
                all_links = re.findall(r'au-extplay-btn[^>]*href=["\']([^"\']+)["\']', text)

            # Filter to only .ac domain links (they work with the AC API)
            ac_links = [l for l in all_links if "animeworld.ac/play/" in l]
            if not ac_links:
                result["error"] = "Nessun link compatibile trovato nella pagina"
                return result

            play_url = ac_links[0]
            if not play_url.startswith("http"):
                play_url = self.BASE_URL.rstrip("/") + play_url

            # Extract short ID: /play/{anime}.{dbid}/{short_id}
            id_match = re.search(r'/play/[^/]+/([^/]+)', play_url)
            if not id_match:
                result["error"] = "无法从播放链接提取短ID"
                return result

            short_id = id_match.group(1)

            # Call AC API → real MP4 URL
            api_data = self._fetch_json(f"https://www.animeworld.ac/api/episode/info?id={short_id}")
            if api_data and isinstance(api_data, dict) and api_data.get("grabber"):
                mp4_url = api_data["grabber"]
                result["video_url"] = mp4_url
                self._ep_video_cache[cache_key] = mp4_url
                return result
            else:
                result["error"] = "AC API 未返回视频地址"
        except Exception as e:
            logger.warning(f"Video resolution failed for {episode_id}: {e}")
            result["error"] = str(e)[:80]

        return result

    def scrape_latest_updates(self, db, loop=None) -> list[dict]:
        """Scrape the latest updates page and add/update them in the DB."""
        logger.info("Avvio scraping nuovi episodi...")
        url = f"{self.BASE_URL}/updated"
        soup = self._fetch(url)
        if not soup:
            logger.warning("Scraping nuovi episodi fallito: nessuna risposta.")
            return []

        items = soup.select(".item")
        if not items:
            logger.warning("Nessun anime trovato nella pagina /updated.")
            return []

        anime_list = []
        for div in items:
            thumb = div.find("a", class_="thumb")
            if not thumb:
                continue

            href = thumb.get("href", "")
            if not href.startswith("/play/") and "/anime/" not in href and "/watch/" not in href:
                continue

            aid = self._extract_id(href)
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
                "url": f"{self.BASE_URL}/{href.lstrip('/')}" if not href.startswith("http") else href,
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

        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
        future = asyncio.run_coroutine_threadsafe(db.add_batch(anime_list), loop)
        future.result()
        logger.info("Database aggiornato con i nuovi episodi con successo.")

        for anime in anime_list:
            try:
                url = anime.get("url")
                if isinstance(url, str):
                    detail = self.get_anime_detail(url)
                    eps = detail.get("episodes", [])
                    for ep in eps:
                        ep["anime_id"] = anime["id"]
                    if eps:
                        future = asyncio.run_coroutine_threadsafe(db.add_episodes(eps), loop)
                        future.result()
            except Exception as e:
                logger.warning(f"Failed to fetch episodes for {anime.get('id')}: {e}")

        return anime_list

    def get_latest_episodes(self) -> dict:
        """Fetch the 'Ultimi Episodi' from the homepage."""
        # First try the AJAX schedule endpoint (new .or.at)
        data = self._fetch_json(f"{self.BASE_URL}/ajax/schedule")
        if data and data.get("result"):
            html = data["result"]
            soup = BeautifulSoup(html, "html.parser")
            results = self._parse_schedule_html(soup)
            if results:
                return results

        # Fallback: scrape homepage directly
        url = f"{self.BASE_URL}/"
        soup = self._fetch(url)
        if not soup:
            return {"error": "Failed to fetch homepage"}

        widget = soup.select_one("div.widget.hotnew")
        if not widget:
            return {"error": "Widget non trovato"}

        results = {}
        contents = widget.find_all("div", class_="content")
        for content in contents:
            tab_name = content.get("data-name", "unknown")
            items_list = []

            items = content.find_all("div", class_="item")
            for item in items:
                thumb = item.find("a", class_="poster")
                if not thumb:
                    continue

                href = thumb.get("href", "")
                anime_id = self._extract_id(href)
                img = thumb.find("img")
                img_url = img.get("src") or img.get("data-src") if img else ""

                status_div = thumb.find("div", class_="status")
                ep_text = ""
                type_badges = []
                if status_div:
                    ep_div = status_div.find("div", class_="ep")
                    if ep_div:
                        ep_text = ep_div.get_text(strip=True)
                    for badge_class in ["dub", "ona", "movie", "special"]:
                        badge = status_div.find("div", class_=badge_class)
                        if badge:
                            type_badges.append(badge.get_text(strip=True))

                name_link = item.find("a", class_="name")
                title = name_link.get_text(strip=True) if name_link else ""

                items_list.append({
                    "id": anime_id,
                    "title": title,
                    "url": f"{self.BASE_URL}{href}" if not href.startswith("http") else href,
                    "image": img_url,
                    "episode": ep_text,
                    "badges": type_badges
                })

            results[tab_name] = items_list

        return results

    def _parse_schedule_html(self, soup: BeautifulSoup) -> dict:
        """Parse the schedule HTML returned by /ajax/schedule into structured data."""
        results = {}
        # The slider contains groups of episodes organized by day
        sliders = soup.select(".slider")
        if not sliders:
            return {}

        for slider in sliders:
            items = slider.select(".item")
            for item in items:
                link = item.select_one("a[href*='/watch/']")
                if not link:
                    continue
                href = link.get("href", "")
                anime_id = self._extract_id(href)
                if not anime_id:
                    continue

                img = item.select_one("img")
                img_url = img.get("src") or img.get("data-src") or "" if img else ""
                if img_url and img_url.startswith("//"):
                    img_url = "https:" + img_url

                title_el = item.select_one(".name, .d-title, a.name")
                title = title_el.get_text(strip=True) if title_el else ""

                ep_link = item.select_one("a[href*='/ep-']")
                ep_text = ep_link.get_text(strip=True) if ep_link else ""

                tab_key = "latest"  # Default tab
                results.setdefault(tab_key, []).append({
                    "id": anime_id,
                    "title": title,
                    "url": href if href.startswith("http") else f"{self.BASE_URL}{href}",
                    "image": img_url,
                    "episode": ep_text,
                    "badges": [],
                })

        return results
