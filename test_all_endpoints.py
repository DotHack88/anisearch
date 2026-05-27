import urllib.request
import json

BASE = "http://localhost:8000"

def test(name, url):
    try:
        r = urllib.request.urlopen(url)
        d = json.loads(r.read())
        return d
    except Exception as e:
        print(f"  ERRORE: {e}")
        return None

# 1. /status
print("=== /status ===")
d = test("status", f"{BASE}/status")
if d:
    print(f"  Status: {d['status']}, Anime: {d['cached_anime']}, Ready: {d['cache_ready']}")

# 2. /catalog (per_page min=10)
print("\n=== /catalog ===")
d = test("catalog", f"{BASE}/catalog?page=0&per_page=10")
if d:
    print(f"  Totale: {d['total']}, Pagine: {d['total_pages']}, Items: {len(d['items'])}")
    if d['items']:
        print(f"  Primo: {d['items'][0]['title']}")

# 3. /filters
print("\n=== /filters ===")
d = test("filters", f"{BASE}/filters")
if d:
    print(f"  Generi: {len(d['genres'])}, Anni: {len(d['years'])}, Stati: {len(d['statuses'])}")

# 4. /search
print("\n=== /search?q=naruto ===")
d = test("search", f"{BASE}/search?q=naruto")
if d:
    print(f"  Risultati: {d['count']}")
    if d['results']:
        print(f"  Primo: {d['results'][0]['title']}")

# 5. /anime/{id}
print("\n=== /anime/Ze1Qv (Naruto) ===")
d = test("anime", f"{BASE}/anime/Ze1Qv")
if d:
    print(f"  Titolo: {d.get('title')}")
    print(f"  Episodi: {len(d.get('episodes', []))}")
    print(f"  Generi: {d.get('genres', [])}")

# 6. /watch (sessione vuota)
print("\n=== /watch ===")
d = test("watch", f"{BASE}/watch")
if d is not None:
    print(f"  Progresso recente: {len(d)} items")

# 7. /latest-episodes
print("\n=== /latest-episodes ===")
d = test("latest-episodes", f"{BASE}/latest-episodes")
if d:
    if 'error' in d:
        print(f"  Nota: {d['error']} (normale se il sito e' bloccato)")
    else:
        for tab, items in d.items():
            print(f"  {tab}: {len(items)} episodi")

# 8. /new
print("\n=== /new ===")
d = test("new", f"{BASE}/new")
if d:
    print(f"  Episodi recenti: {len(d.get('episodes', []))}")

print("\n" + "="*50)
print("TUTTI I TEST ENDPOINT COMPLETATI")
print("="*50)
