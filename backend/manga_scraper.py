"""
MangaWorld Scraper — BeautifulSoup + requests
Scrapa tutte le pagine da mangaworld.me
"""

import re
import time
import logging
import requests
from bs4 import BeautifulSoup
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mangaworld.me"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
    "Connection": "keep-alive",
    "Referer": f"{BASE_URL}/",
}

class MangaWorldScraper:
    """URL costanti del sito aggiornato (dal 2024-2025 mangaworld.mx → mangaworld.me)."""
    OLD_CDN = "cdn.mangaworld.mx"
    NEW_CDN = "cdn.mangaworld.me"
    OLD_DOMAIN = "mangaworld.mx"
    NEW_DOMAIN = "mangaworld.me"
    # Mantieni BASE_URL sul nuovo dominio per i fetch
    BASE_URL_LOCAL = "https://www.mangaworld.me"

    def __init__(self, delay: float = 0.5, timeout: tuple = (5, 15)):
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
            "Connection": "keep-alive",
            "Referer": f"{self.BASE_URL_LOCAL}/",
        })

    @staticmethod
    def normalise_url(url: str) -> str:
        """Normalize manga/chapter URLs from old .mx to new .me domain.
        Handles both full URLs and relative paths."""
        if not url:
            return url
        url = url.replace(MangaWorldScraper.OLD_CDN, MangaWorldScraper.NEW_CDN)
        url = url.replace(f"https://{MangaWorldScraper.OLD_DOMAIN}", f"https://{MangaWorldScraper.NEW_DOMAIN}")
        url = url.replace(f"http://{MangaWorldScraper.OLD_DOMAIN}", f"https://{MangaWorldScraper.NEW_DOMAIN}")
        # Also handle bare domain (no protocol) in case DB has it
        if MangaWorldScraper.OLD_DOMAIN in url and not url.startswith("http"):
            url = url.replace(MangaWorldScraper.OLD_DOMAIN, MangaWorldScraper.NEW_DOMAIN)
        return url

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

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _extract_id_from_url(href: str) -> str:
        """Extract manga ID from URL like /manga/1345/naruto → '1345---naruto'."""
        parts = href.rstrip("/").split("/")
        if len(parts) >= 3 and parts[-2].isdigit():
            return f"{parts[-2]}---{parts[-1]}"
        return parts[-1] if parts else ""

    def _parse_card(self, card) -> dict | None:
        """Parse a single archive-card into a manga dict."""
        cover_link = card.select_one("a.card-cover")
        if not cover_link:
            return None

        href = cover_link.get("href", "")
        if not href or "manga" not in href:
            return None

        # Title
        title_el = card.select_one(".card-title a")
        title = title_el.get_text(strip=True) if title_el else ""

        # Image — try src first, then data-src
        img = cover_link.select_one("img")
        image = ""
        if img:
            image = img.get("src") or img.get("data-src") or ""
            # Make relative URLs absolute
            if image and not image.startswith("http"):
                image = BASE_URL.rstrip("/") + ("/" if not image.startswith("/") else "") + image.lstrip("/")
                # Some sites use //cdn.example.com — prepend https
                if image.startswith("//"):
                    image = "https:" + image

        # Status / type from card-tags
        status = ""
        tags_el = card.select_one(".card-tags a")
        if tags_el:
            tag_text = tags_el.get_text(strip=True).lower()
            if tag_text in ("manga", "manhwa", "manhua"):
                status = tag_text.capitalize()

        manga_id = self._extract_id_from_url(href)
        if not manga_id:
            return None

        return {
            "id": manga_id,
            "title": title,
            "url": href,
            "image": image,
            "status": status,
            "genres": [],
            "year": "",
            "type": "",
            "rating": "",
        }

    # ── Search ───────────────────────────────────────────────────────────

    def search(self, keyword: str) -> list[dict]:
        """Search for a manga by keyword via the archive search endpoint."""
        url = f"{BASE_URL}/archive?keyword={keyword}"
        soup = self._fetch(url)
        if not soup:
            return []

        results = []
        for card in soup.select("article.card.archive-card"):
            item = self._parse_card(card)
            if item:
                results.append(item)
        return results

    # ── Archive scraping ────────────────────────────────────────────────

    def _scrape_archive_page(self, page: int) -> list[dict]:
        """Scrapa una singola pagina dell'archivio e restituisce i manga trovati."""
        url = f"{BASE_URL}/archive?page={page}"
        soup = self._fetch(url)
        if not soup:
            return []

        results = []
        for card in soup.select("article.card.archive-card"):
            item = self._parse_card(card)
            if item:
                results.append(item)
        return results

    def scrape_full_archive(self, progress_cb=None, max_workers: int = 4) -> list[dict]:
        """Scrapa l'intero archivio MangaWorld su tutte le pagine disponibili.

        Args:
            progress_cb: Callable(scraped, total) chiamato ad ogni pagina completata.
            max_workers: Thread paralleli (default 4 per non sovraccaricare il server).
        """
        # Determina l'ultima pagina valida scendendo da un massimo ragionevole
        MAX_PAGES = 500
        logger.info(f"Rilevamento numero pagine archivio MangaWorld (max {MAX_PAGES})...")

        last_page = 1
        for p in range(MAX_PAGES, 1, -1):
            test = self._scrape_archive_page(p)
            if test:
                last_page = p
                break
        logger.info(f"Archivio MangaWorld: {last_page} pagine rilevate.")

        all_manga: list[dict] = []
        seen_ids: set[str] = set()

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_page = {executor.submit(self._scrape_archive_page, p): p for p in range(1, last_page + 1)}
            completed = 0
            for future in as_completed(future_to_page):
                page_results = future.result()
                for m in page_results:
                    if m["id"] not in seen_ids:
                        seen_ids.add(m["id"])
                        all_manga.append(m)
                completed += 1
                if progress_cb:
                    progress_cb(completed, last_page)
                logger.info(f"Pagina {future_to_page[future]}/{last_page}: {len(page_results)} manga")
                time.sleep(self.delay)

        logger.info(f"Scraping archivio completato: {len(all_manga)} manga unici totali.")
        return all_manga

    # ── Manga detail & chapters ─────────────────────────────────────────

    def get_manga_detail(self, manga_url: str) -> dict:
        """Get full manga detail and chapters list."""
        if not manga_url.startswith("http"):
            manga_url = f"{BASE_URL}{manga_url}"

        soup = self._fetch(manga_url)
        if not soup:
            return {"chapters": [], "description": "", "genres": []}

        detail = {
            "description": "",
            "genres": [],
            "status": "",
            "year": "",
            "chapters": [],
            "cover": "",
            "type": "",
            "rating": "",
            "author": "",
            "artist": "",
        }

        # Title — h1 on detail page
        title_el = soup.select_one("h1.name, h1.title, h1[class*=title]")
        if title_el:
            detail["title"] = title_el.get_text(strip=True)

        # Cover image — look for img inside manga hero/cover area
        cover_el = soup.select_one("img[src*='mangas'], img[data-src*='mangas']")
        if cover_el:
            detail["cover"] = cover_el.get("src") or cover_el.get("data-src") or ""
            if detail["cover"] and not detail["cover"].startswith("http"):
                detail["cover"] = BASE_URL.rstrip("/") + ("/" if not detail["cover"].startswith("/") else "") + detail["cover"].lstrip("/")
            elif detail["cover"].startswith("//"):
                detail["cover"] = "https:" + detail["cover"]

        # Description — find section with heading "Trama" or similar
        desc_el = soup.find("section", string=lambda t: t and "trama" in t.lower())
        if not desc_el:
            desc_el = soup.select_one("div.trama, div.description, #plot")
        if desc_el:
            # Get text after the heading
            texts = [line.strip() for line in desc_el.get_text("\n").splitlines() if line.strip()]
            if texts:
                # Skip the heading line itself
                detail["description"] = " ".join(texts[1:] if len(texts) > 1 else texts)

        # Meta info from dl.fact-list (dt/dd pairs)
        facts = soup.select("dl.fact-list dt, dl.fact-list dd")
        fact_map: dict[str, str] = {}
        for i in range(0, len(facts) - 1, 2):
            key = facts[i].get_text(strip=True).lower()
            val = facts[i + 1].get_text(strip=True) if i + 1 < len(facts) else ""
            # Remove empty values
            if val and "—".encode().decode() not in val and val != "N/A":
                fact_map[key] = val

        for label, value in fact_map.items():
            if "autore" in label or "author" in label:
                detail["author"] = value
            elif "artista" in label or "artist" in label:
                detail["artist"] = value
            elif "tipo" in label or "type" in label:
                detail["type"] = value
            elif "stato" in label or "status" in label:
                detail["status"] = value
            elif "anno" in label or "uscita" in label:
                m = re.search(r"\d{4}", value)
                detail["year"] = m.group(0) if m else value
            elif "genere" in label or "tag" in label:
                detail["genres"] = [g.strip() for g in value.split(",") if g.strip()]

        # Chapters — section.panel.manga-chapters > ul.ch-list.volume-chapters > li > a
        chapters_section = soup.select_one("section.panel.manga-chapters")
        if chapters_section:
            for ul in chapters_section.select("ul.ch-list.volume-chapters"):
                for li in ul.select("li"):
                    a_tag = li.select_one("a[href*='/read/']")
                    if not a_tag:
                        continue
                    href = a_tag.get("href", "")
                    if not href.startswith("http"):
                        href = BASE_URL.rstrip("/") + "/" + href.lstrip("/")

                    # Title comes from .ch-name span only (not the date in .ch-date)
                    name_el = a_tag.select_one(".ch-name")
                    title = name_el.get_text(strip=True) if name_el else a_tag.get_text(strip=True)
                    title = re.sub(r"\s+", " ", title).strip()

                    # Extract chapter number: first integer in title
                    num_match = re.search(r"(\d+(?:\.\d+)?)", title)
                    ch_number = float(num_match.group(1)) if num_match else -1.0

                    # Volume — check parent li for span.vol or similar
                    vol_span = li.select_one("span.vol, .vol, .volume")
                    vol = vol_span.get_text(strip=True) if vol_span else ""

                    # Chapter ID = last path segment before query string
                    ch_id = href.rstrip("/").split("/")[-1].split("?")[0]

                    detail["chapters"].append({
                        "id": ch_id,
                        "url": href,
                        "title": title,
                        "volume": vol,
                        "number": ch_number,
                    })

        # Sort chapters by number descending (newest first)
        detail["chapters"].sort(key=lambda c: c["number"], reverse=True)

        return detail

    # ── Chapter images ──────────────────────────────────────────────────

    def get_chapter_images(self, chapter_url: str) -> list[str]:
        """Get the list of image URLs for a specific chapter by reading <img> tags."""
        if not chapter_url.startswith("http"):
            chapter_url = f"{BASE_URL}{chapter_url}"

        soup = self._fetch(chapter_url)
        if not soup:
            return []

        images = []
        for img in soup.select("img[src*='cdn.mangaworld']:not([src*='logo'])"):
            src = img.get("src") or img.get("data-src") or ""
            if src:
                # Make relative URLs absolute
                if src.startswith("//"):
                    src = "https:" + src
                elif src.startswith("/"):
                    src = BASE_URL.rstrip("/") + src
                images.append(src)

        return images

    # ── Latest chapters (homepage) ──────────────────────────────────────

    def get_latest_chapters(self) -> list[dict]:
        """Scrapa la homepage di MangaWorld e restituisce i manga con ultimi capitoli."""
        soup = self._fetch(f"{BASE_URL}/")
        if not soup:
            return []

        results: dict[str, dict] = {}  # manga_id → accumulator

        # Homepage uses <article class="card"> with chapter links inside.
        # We iterate all .latest-grid cards, extract title+cover once,
        # then gather up to 2 chapter links per card.
        for card in soup.select("div.latest-grid article.card, section.latest article.card"):
            manga_url = ""
            manga_title = ""
            manga_image = ""

            # Cover image and manga detail link
            cover_link = card.select_one("a.card-cover")
            if cover_link:
                manga_url = cover_link.get("href", "")
                img = cover_link.select_one("img")
                if img:
                    manga_image = img.get("src") or img.get("data-src") or ""
                    if manga_image and not manga_image.startswith("http"):
                        if manga_image.startswith("//"):
                            manga_image = "https:" + manga_image
                        elif manga_image.startswith("/"):
                            manga_image = BASE_URL.rstrip("/") + manga_image

            # Title — try .card-title first, then fall back to link text of card-cover
            title_el = card.select_one(".card-title a, h3.card-title a")
            if title_el:
                manga_title = title_el.get_text(strip=True)
            else:
                manga_title = cover_link.get_text(strip=True) if cover_link else ""

            if not manga_url:
                continue

            manga_id = self._extract_id_from_url(manga_url)
            if not manga_id:
                continue

            chapters: list[dict] = []
            for ch_link in card.select("a.ch[href*='/read/']")[:2]:  # max 2 chapters
                ch_href = ch_link.get("href", "")
                if not ch_href.startswith("http"):
                    ch_href = BASE_URL.rstrip("/") + "/" + ch_href.lstrip("/")

                # Chapter title from .ch-name span (avoids date concatenation)
                name_el = ch_link.select_one(".ch-name")
                if name_el:
                    raw = name_el.get_text()
                    # Spans are glued together ("CapitoloCap. 312") — insert space before capitals after lowercase
                    ch_title = re.sub(r'([a-z])([A-Z])', r'\1 \2', raw).strip()
                else:
                    ch_title = ch_link.get("title") or ch_link.get_text(strip=True)
                    ch_title = re.sub(r"\s+", " ", ch_title).strip()

                ch_id = ch_href.rstrip("/").split("/")[-1].split("?")[0]
                is_new = bool(ch_link.select_one(".badge-new"))

                chapters.append({
                    "id": ch_id,
                    "title": ch_title,
                    "url": ch_href,
                    "is_new": is_new,
                })

            if chapters:
                results[manga_id] = {
                    "id": manga_id,
                    "title": manga_title,
                    "url": manga_url if manga_url.startswith("http") else BASE_URL.rstrip("/") + manga_url,
                    "image": manga_image,
                    "chapters": chapters,
                }

        return list(results.values())


if __name__ == "__main__":
    # Test
    scraper = MangaWorldScraper()

    print("=== Search test ===")
    res = scraper.search("naruto")
    print(f"Trovati {len(res)} risultati:")
    for r in res[:3]:
        print(f"  {r['title']}  id={r['id']}  url={r['url']}")

    if res:
        print("\n=== Detail test ===")
        detail = scraper.get_manga_detail(res[0]["url"])
        print(f"Title: {detail.get('title')}")
        print(f"Status: {detail.get('status')}")
        print(f"Author: {detail.get('author')}")
        print(f"Chapters: {len(detail.get('chapters', []))}")
        if detail["chapters"]:
            print(f"  Primo capitolo: {detail['chapters'][0]['title']}")
            imgs = scraper.get_chapter_images(detail["chapters"][0]["url"])
            print(f"  Immagini capitolo: {len(imgs)}")
            if imgs:
                print(f"  Prima img: {imgs[0][:100]}")