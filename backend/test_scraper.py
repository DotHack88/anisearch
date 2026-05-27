"""
Esegui con: python test_scraper.py
Diagnostica cosa vede il scraper sulla pagina AnimeWorld.
"""
import requests
from bs4 import BeautifulSoup

URL = "https://www.animeworld.ac/az-list/N"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Referer": "https://www.animeworld.ac/",
}

print(f"Fetching: {URL}\n")
resp = requests.get(URL, headers=HEADERS, timeout=15)
print(f"Status code: {resp.status_code}")
print(f"Content-Type: {resp.headers.get('content-type', '')}")
print(f"HTML length: {len(resp.text)} caratteri")
print("\n--- Primi 2000 caratteri dell'HTML ---\n")
print(resp.text[:2000])
print("\n--- Fine preview ---\n")

soup = BeautifulSoup(resp.text, "html.parser")
print(f"Tag <title>: {soup.title.get_text() if soup.title else 'NON TROVATO'}")

play_links = soup.find_all("a", href=lambda h: h and "/play/" in h)
print(f"Link /play/ trovati: {len(play_links)}")
if play_links:
    print("Primi 5 link:")
    for a in play_links[:5]:
        print(f"  href={a.get('href')}  testo={a.get_text(strip=True)[:40]}")

print("\nTutte le classi CSS uniche (prime 40):")
classes = set()
for tag in soup.find_all(class_=True):
    for c in tag.get("class", []):
        classes.add(c)
print(sorted(classes)[:40])