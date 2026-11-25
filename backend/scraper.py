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
    "https://animeworld.or.at",   # nuovo, Laravel + AJAX
    "https://www.animeworld.ac",   # vecchio, ancora funzionante
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
        """Search for an anime using the AJAX search endpoint."""
        url = f"{self.BASE_URL}/ajax/anime/search?keyword={requests.utils.quote(keyword)}"
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

        soup = self._fetch(anime_url)
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

        # Episodes
        episodes = []
        seen_ep = set()
        ep_pattern = re.compile(r"(?:/ep-\d+|/episode/\d+|\.ep\d+|ep[-_]?\d+)")

        # Collect extplay buttons per episode (needed because new .or.at hides video behind
        # external-player redirects; the /api/episode/info endpoint no longer works there).
        # We parse these on-the-fly and attach them as video_url so WatchPage can use them.
        extplay_by_ep_id: dict[str, str] = {}

        # Method 1: find all links matching episode pattern
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if not ep_pattern.search(href):
                continue
            # Extract episode number
            num_match = re.search(r"(\d+(?:\.\d+)?)", href)
            ep_num = num_match.group(1) if num_match else str(len(episodes) + 1)
            ep_id = href.rstrip("/").split("/")[-1].split("?")[0]
            if ep_id and ep_id not in seen_ep:
                seen_ep.add(ep_id)
                ep_title = a.get_text(strip=True)
                episodes.append({
                    "number": ep_num,
                    "url": href if href.startswith("http") else f"{self.BASE_URL}{href}",
                    "id": ep_id,
                    "title": ep_title,
                })

        # Strategy: extract extplay links per episode from the page HTML
        # New .or.at site hides videos behind third-party players; extplay buttons
        # contain stable redirect URLs that work for playback.
        # NOTE: extplay buttons appear in the PLAYER area of EACH EPISODE PAGE,
        # not on the anime detail listing page. We scrape each episode page separately.
        extplay_by_id: dict[str, str] = {}

        # For each collected episode, fetch its page and extract the .ac extplay link
        # This is intentional — the new site loads video sources dynamically via JS
        for ep in episodes:
            if ep["id"] in self._ep_video_cache:
                extplay_by_id[ep["id"]] = self._ep_video_cache[ep["id"]]
                continue
            try:
                ep_r = self.session.get(ep["url"], timeout=self.timeout)
                if ep_r.status_code != 200:
                    continue
                ep_text = ep_r.text
                # Match au-extplay-btn hrefs — prefer animeworld.ac domain
                links = re.findall(
                    r'<a\s+class="btn\s+btn-primary\s+au-extplay-btn"\s+href="([^"]+)"',
                    ep_text,
                )
                if links:
                    ac_links = [l for l in links if "animeworld.ac/play/" in l]
                    url = ac_links[0] if ac_links else links[0]
                    extplay_by_id[ep["id"]] = url
                    self._ep_video_cache[ep["id"]] = url
                time.sleep(self.delay)
            except Exception:
                continue

        # Attach video_url to matching episodes
        for ep in episodes:
            if ep["id"] in extplay_by_id:
                ep["video_url"] = extplay_by_id[ep["id"]]

        detail["episodes"] = episodes
        return detail

    def get_episode_video_url(self, episode_id: str) -> dict:
        """Get the direct video stream URL for an episode.

        Tries strategies in order:
        1. Check in-memory cache populated during anime detail scrape
        2. Old /api/episode/info?id=... grabber endpoint (legacy sites)
        3. Fetch the episode page and extract au-extplay-btn href (.ac links work reliably)
        Returns video_url="" on failure.
        """
        result = {"video_url": "", "error": ""}

        # Strategy 0: check in-memory cache first
        if episode_id in self._ep_video_cache:
            result["video_url"] = self._ep_video_cache[episode_id]
            return result

        # Strategy 1: old API (grabber-style, legacy domains)
        try:
            data = self._fetch_json(f"{self.BASE_URL}/api/episode/info?id={episode_id}")
            if data and isinstance(data, dict) and data.get("grabber"):
                result["video_url"] = data["grabber"]
                return result
        except Exception:
            pass

        # Strategy 2: fetch episode detail page and extract .ac extplay link
        # episode_id is like 'ep-1'; we build the watch page URL from the known pattern
        ep_num_match = re.match(r"ep-(\d+)", episode_id)
        if ep_num_match:
            ep_num = ep_num_match.group(1)
            # Build URL: https://animeworld.or.at/watch/{slug}/ep-{num}
            # We don't know the slug here; try common patterns
            candidates = [
                f"{self.BASE_URL}/{episode_id}",  # e.g. .../ep-1
            ]
            # Also try extracting from stored episode URLs in DB if accessible
            for candidate_url in candidates:
                try:
                    r = self.session.get(candidate_url, timeout=self.timeout)
                    if r.status_code != 200:
                        continue
                    text = r.text
                    # Extract all extplay button hrefs — prefer .ac domain
                    links = re.findall(
                        r'<a\s+class="btn\s+btn-primary\s+au-extplay-btn"\s+href="([^"]+)"',
                        text,
                    )
                    if links:
                        ac_links = [l for l in links if "animeworld.ac/play/" in l]
                        result["video_url"] = ac_links[0] if ac_links else links[0]
                        return result
                except Exception:
                    continue

        result["error"] = "视频流暂不可用"
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
