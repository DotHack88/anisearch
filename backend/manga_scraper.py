"""
MangaWorld Scraper — BeautifulSoup + requests
Scrapa tutte le pagine da mangaworld.mx
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

BASE_URL = "https://www.mangaworld.mx"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
    "Connection": "keep-alive",
    "Referer": f"{BASE_URL}/",
}

class MangaWorldScraper:
    def __init__(self, delay: float = 0.5, timeout: tuple = (5, 15)):
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

    def search(self, keyword: str) -> list[dict]:
        """Search for a manga."""
        url = f"{BASE_URL}/archive?keyword={keyword}"
        soup = self._fetch(url)
        if not soup:
            return []

        results = []
        items = soup.select(".comics-grid .entry")
        for item in items:
            a_tag = item.select_one("a.thumb")
            if not a_tag:
                continue
            href = a_tag.get("href", "")
            title_tag = item.select_one(".name")
            title = title_tag.get_text(strip=True) if title_tag else ""
            img_tag = a_tag.select_one("img")
            image = img_tag.get("src") if img_tag else ""
            
            # URL is like: https://www.mangaworld.mx/manga/1798/boruto-naruto-next-generations
            mparts = href.rstrip("/").split("/")
            if len(mparts) >= 2 and mparts[-2].isdigit():
                manga_id = f"{mparts[-2]}---{mparts[-1]}"
            else:
                manga_id = mparts[-1] if href else ""
            
            results.append({
                "id": manga_id,
                "title": title,
                "url": href,
                "image": image,
            })
        return results

    def _scrape_archive_page(self, page: int) -> list[dict]:
        """Scrapa una singola pagina dell'archivio e restituisce i manga trovati."""
        url = f"{BASE_URL}/archive?sort=a-z&page={page}"
        soup = self._fetch(url)
        if not soup:
            return []

        results = []
        for entry in soup.select(".comics-grid .entry"):
            thumb = entry.select_one("a.thumb")
            if not thumb:
                continue
            href = thumb.get("href", "")
            img = thumb.select_one("img")
            image = img.get("src", "") if img else ""

            title_tag = entry.select_one(".name a") or entry.select_one("a.manga-title")
            title = title_tag.get_text(strip=True) if title_tag else ""

            status_tag = entry.select_one(".status a")
            status = status_tag.get_text(strip=True) if status_tag else ""

            genres = [g.get_text(strip=True) for g in entry.select(".genres a")]

            year_tag = entry.select_one(".year")
            year = ""
            if year_tag:
                year_text = year_tag.get_text(strip=True)
                import re as _re
                m = _re.search(r"\d{4}", year_text)
                year = m.group(0) if m else ""

            parts = href.rstrip("/").split("/")
            if len(parts) >= 2 and parts[-2].isdigit():
                manga_id = f"{parts[-2]}---{parts[-1]}"
            else:
                manga_id = parts[-1] if href else ""

            if manga_id:
                results.append({
                    "id": manga_id,
                    "title": title,
                    "url": href,
                    "image": image,
                    "status": status,
                    "genres": genres,
                    "year": year,
                    "type": "",
                    "rating": "",
                })
        return results

    def scrape_full_archive(self, progress_cb=None, max_workers: int = 4) -> list[dict]:
        """Scrapa l'intero archivio MangaWorld su tutte le pagine disponibili.
        
        Args:
            progress_cb: Callable(scraped, total) chiamato ad ogni pagina completata.
            max_workers: Thread paralleli (default 4 per non sovraccaricare il server).
        """
        # Determina l'ultima pagina valida
        logger.info("Rilevamento numero pagine archivio MangaWorld...")
        last_page = 1
        for p in range(210, 1, -1):
            test = self._scrape_archive_page(p)
            if test:
                last_page = p
                break
        logger.info(f"Archivio MangaWorld: {last_page} pagine rilevate.")

        all_manga: list[dict] = []
        pages = list(range(1, last_page + 1))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_page = {executor.submit(self._scrape_archive_page, p): p for p in pages}
            completed = 0
            for future in as_completed(future_to_page):
                page_results = future.result()
                all_manga.extend(page_results)
                completed += 1
                if progress_cb:
                    progress_cb(completed, last_page)
                logger.info(f"Pagina {future_to_page[future]}/{last_page}: {len(page_results)} manga")
                time.sleep(self.delay)

        logger.info(f"Scraping archivio completato: {len(all_manga)} manga totali.")
        return all_manga

    def get_manga_detail(self, manga_url: str) -> dict:
        """Get full manga detail and chapters list."""
        if not manga_url.startswith("http"):
            manga_url = f"{BASE_URL}{manga_url}"
            
        soup = self._fetch(manga_url)
        if not soup:
            return {"chapters": [], "description": "", "genres": []}

        detail = {
            "description": "", "genres": [], "status": "",
            "year": "", "chapters": [], "cover": "", "type": "",
            "rating": "", "author": "", "artist": ""
        }

        # Title
        title_el = soup.select_one("h1.name")
        if title_el:
            detail["title"] = title_el.get_text(strip=True)

        # Cover image
        cover_el = soup.select_one("div.thumb img")
        if cover_el:
            detail["cover"] = cover_el.get("src") or ""

        # Description
        desc = soup.select_one("div#noidungm")
        if desc:
            detail["description"] = desc.get_text(strip=True)

        # Meta info
        meta_items = soup.select("div.info div.meta-data > div")
        for meta in meta_items:
            label_tag = meta.select_one("span.font-weight-bold")
            if not label_tag:
                continue
            label = label_tag.get_text(strip=True).lower()
            val = meta.get_text(strip=True).replace(label_tag.get_text(strip=True), "").strip()
            
            if "gener" in label:
                detail["genres"] = [a.get_text(strip=True) for a in meta.select("a")]
            elif "stato" in label or "status" in label:
                detail["status"] = val
            elif "anno" in label or "year" in label:
                detail["year"] = val
            elif "tipo" in label or "type" in label:
                detail["type"] = val
            elif "autor" in label or "author" in label:
                detail["author"] = val
            elif "artist" in label:
                detail["artist"] = val

        # Chapters
        chapters = []
        chapter_divs = soup.select(".chapters-wrapper .chapter")
        for div in chapter_divs:
            a_tag = div.select_one("a.chap")
            if not a_tag:
                continue
            href = a_tag.get("href", "")
            title = a_tag.get_text(strip=True)
            
            vol_span = div.select_one("span.vol")
            vol = vol_span.get_text(strip=True) if vol_span else ""
            
            # Extract chapter id from url: /read/manga-slug/en/chapter-number
            ch_id = href.strip("/").split("/")[-1]
            
            chapters.append({
                "id": ch_id,
                "url": href,
                "title": title,
                "volume": vol,
                "number": ch_id
            })
            
        detail["chapters"] = chapters
        return detail

    def get_chapter_images(self, chapter_url: str) -> list[str]:
        """Get the list of image URLs for a specific chapter by parsing embedded JSON."""
        if not chapter_url.startswith("http"):
            chapter_url = f"{BASE_URL}{chapter_url}"

        soup = self._fetch(chapter_url)
        if not soup:
            return []

        # MangaWorld embeds all page data in a window.$MC JSON object in a <script> tag.
        # Structure: {"o":{"w":[[..., {"manga":{...}, "chapter":{...pages, slugFolder, volume:{...}}}]]}}
        import json, re
        
        for script in soup.select("script"):
            raw = script.string or ""
            if '"pages"' not in raw:
                continue
            try:
                m = re.search(r'\({"o":{.*', raw)
                if not m:
                    continue
                text = m.group(0).strip("()")
                data = json.loads(text)

                chapter_data = data["o"]["w"][0][2]["chapter"]
                manga_data   = data["o"]["w"][0][2]["manga"]
                volume_data  = chapter_data.get("volume", {})

                manga_slug  = manga_data.get("slug", "")
                manga_id    = manga_data.get("_id", "")
                vol_slug    = volume_data.get("slugFolder", "")
                vol_id      = volume_data.get("_id", "")
                ch_slug     = chapter_data.get("slugFolder", "")
                ch_id       = chapter_data.get("_id", "")
                pages       = chapter_data.get("pages", [])

                cdn_base = "https://cdn.mangaworld.mx"
                folder = f"{cdn_base}/chapters/{manga_slug}-{manga_id}/{vol_slug}-{vol_id}/{ch_slug}-{ch_id}"

                urls = [f"{folder}/{page}" for page in pages]
                if urls:
                    return urls
            except Exception as e:
                logger.warning(f"Errore parsing JSON capitolo: {e}")

        # Fallback: try img tags (may return only 1)
        images = []
        for img in soup.select("#page img"):
            src = img.get("src") or img.get("data-src")
            if src:
                images.append(src)
        return images

    def get_latest_chapters(self) -> list[dict]:
        """Scrapa la homepage di MangaWorld e restituisce i manga con ultimi capitoli."""
        soup = self._fetch(f"{BASE_URL}/")
        if not soup:
            return []

        results = []
        entries = soup.select("div.comics-grid .entry")
        for entry in entries:
            thumb = entry.select_one("a.thumb")
            if not thumb:
                continue

            href = thumb.get("href", "")
            title_tag = entry.select_one("a.manga-title")
            title = title_tag.get_text(strip=True) if title_tag else ""
            img = thumb.select_one("img")
            image = img.get("src", "") if img else ""

            # Extract manga ID from URL
            parts = href.rstrip("/").split("/")
            if len(parts) >= 2 and parts[-2].isdigit():
                manga_id = f"{parts[-2]}---{parts[-1]}"
            else:
                manga_id = parts[-1] if href else ""

            # Get latest chapters (up to 2)
            chapters = []
            for ch_div in entry.select("div.d-flex.flex-wrap.flex-row")[:2]:
                a = ch_div.select_one("a.xanh")
                if not a:
                    continue
                ch_href = a.get("href", "")
                ch_title = a.get("title", a.get_text(strip=True))
                # Extract chapter ID from URL: last path segment
                ch_id = ch_href.rstrip("/").split("/")[-1]
                is_new = bool(ch_div.select_one("img[alt='Nuovo']"))
                chapters.append({
                    "id": ch_id,
                    "title": ch_title,
                    "url": ch_href,
                    "is_new": is_new,
                })

            results.append({
                "id": manga_id,
                "title": title,
                "url": href,
                "image": image,
                "chapters": chapters,
            })

        return results

if __name__ == "__main__":
    # Test
    scraper = MangaWorldScraper()
    res = scraper.search("naruto")
    print("Search:", res)
    if res:
        detail = scraper.get_manga_detail(res[0]["url"])
        print("Detail:", detail)
        if detail["chapters"]:
            imgs = scraper.get_chapter_images(detail["chapters"][0]["url"])
            print("Images:", imgs)
