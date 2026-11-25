---
name: anime-scraping-debug-guide
description: Guida rapida per debug problemi scraping episodi animeworld quando cambiano dominio/struttura
metadata:
  node_type: memory
  type: project
  created: 2026-11-25
  originSessionId: 824ad7db-e4e0-4208-91a7-e5d4fa35f755
  modified: 2026-11-25T14:16:37.843Z
---

# AnimeWorld Scraper - Debug Guide

## Problemi Comuni e Soluzioni Rapide

### 1. Lista Episodi Vuota (0 episodi)

**Sintomi:**
- API restituisce `"episodes": []` con `"error": "Impossibile caricare gli episodi"`
- Locale funziona, online no (o viceversa)

**Causa più probabile:** Il sito ha cambiato struttura HTML o redirect

**Checklist rapida:**

```bash
# 1. Testa se il sito risponde
curl -I https://www.animeworld.ac/play/nome-anime.ID

# 2. Controlla se c'è redirect
curl -sL https://www.animeworld.ac/play/nome-anime.ID | head -c 500

# 3. Verifica la struttura HTML
python3 -c "
import requests
from bs4 import BeautifulSoup
r = requests.get('URL_ANIME', headers={'User-Agent': 'Mozilla/5.0'})
soup = BeautifulSoup(r.text, 'html.parser')
print('Server divs:', len(soup.find_all('div', class_=lambda x: x and 'server' in str(x))))
print('Episode li:', len(soup.select('li.episode')))
print('Play links:', len([a for a in soup.find_all('a', href=True) if '/play/' in a.get('href','')]))
"
```

### 2. Errori Database (colonna non esistente)

**Sintomi:**
```
asyncpg.exceptions.UndefinedColumnError: column "video_url" of relation "episode" does not exist
```

**Causa:** Nuovo campo aggiunto al modello SQLModel ma migration non eseguita su PostgreSQL

**Fix immediato:**
```python
# Aggiungere nel _ensure_init() dopo create_all:
async def _migrate_add_video_url(self, conn):
    try:
        await conn.execute(text("ALTER TABLE episode ADD COLUMN video_url VARCHAR"))
    except Exception:
        pass  # colonna già esiste
```

### 3. Redirect Multipli (.ac domain)

**Problema:** Il sito `.ac` fa redirect a catena:
- `/play/slug.ID` → 302 → `/play/slug.ID/SHORTID` (primo episodio)
- Se lo scraper segue il redirect, parsea la pagina episodio invece dell'anime

**Soluzione:** Loop di follow redirect con max 3 hop:
```python
resp = self.session.get(url, timeout=self.timeout, allow_redirects=False)
for _ in range(3):  # max 3 redirect
    if resp.status_code in (301, 302) and resp.headers.get('Location'):
        loc = resp.headers['Location']
        if not loc.startswith('http'):
            loc = f"{self.BASE_URL.rstrip('/')}/{loc.lstrip('/')}"
        resp = self.session.get(loc, timeout=self.timeout, allow_redirects=False)
    else:
        break
```

### 4. Cambio Dominio

**Regola d'oro:** Il sito ufficiale è `animeworld.ac` (vedi https://www.animeworlditalia.com/)
- `.or.at` = dominio alternativo/Laravel
- `.so`, `.tv` = altri domini ufficiali
- Altri domini = potenzialmente pericolosi

**Pattern consigliato:**
```python
DOMAINS = [
    "https://www.animeworld.ac",   # PRIMARIO - ufficiale
    "https://animeworld.or.at",   # FALLBACK AJAX search
]
```

## Workflow Debugging Standaard

Quando arriva un bug "lista episodi vuota":

1. **Testa locale prima di online**
   ```bash
   python3 -c "from backend.scraper import AnimeWorldScraper; s=AnimeWorldScraper(); print(s.get_anime_detail('URL'))"
   ```

2. **Confronta output locale vs online**
   - Local: `curl http://localhost:8000/anime/{id}`
   - Online: `curl https://anisearch-8jph.onrender.com/api/anime/{id}`

3. **Verifica i log di Render**
   ```
   Error columns: asyncpg.exceptions.UndefinedColumnError
   Error scraping: HTTP 403 / Connection refused
   ```

4. **Controlla struttura HTML**
   - Usa browser DevTools → Network → XHR per vedere richieste API
   - Ispeziona DOM per trovare nuovi selector

5. **Verifica deployment**
   ```bash
   git log --oneline -3  # ultime commit
   curl https://anisearch-8jph.onrender.com/status  # stato online
   ```

## Deploy Checklist

Prima di fare deploy su Render:

- [ ] Test locale completo (`python run_backend.py`)
- [ ] Tutti i test passeranno (`pytest backend/tests/`)
- [ ] Commit pushato su main
- [ ] Render Manual Deploy eseguito
- [ ] Log di avvio privi di errori
- [ ] Endpoint `/api/anime/{id}` restituisce episodi

## Files Chiave

| File | Scopo |
|------|-------|
| `backend/scraper.py` | Logica estrazione episodi |
| `backend/database.py` | Modelli SQLModel + migration |
| `backend/main.py` | Endpoint FastAPI |
| `Dockerfile` | Build immagine Render |
| `vercel.json` | Routing frontend→backend |

## Comandi Utili

```bash
# Test locale scraping
source .venv/Scripts/activate && python -c "
from backend.scraper import AnimeWorldScraper
s = AnimeWorldScraper()
d = s.get_anime_detail('https://www.animeworld.ac/play/...')
print(len(d.get('episodes', [])))
"

# Test endpoint locale
curl http://localhost:8000/anime/{anime_id}

# Test endpoint online
curl https://anisearch-8jph.onrender.com/api/anime/{anime_id}

# View Render logs
render service logs srv-d8acd9p9rddc73a0q580

# Trigger deploy manuale
# Dashboard → Service → Manual Deploy → Deploy latest commit
```
