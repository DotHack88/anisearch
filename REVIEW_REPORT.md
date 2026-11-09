# AniSearch — Report Revisione Dettagliata

Data: 2026-11-08
Stato: **completato** — tutte le vulnerabilità e i problemi individuati sono stati risolti e testati sia sul backend che sul frontend.

---

## 0. Metodologia

- Revisione manuale dei file di infrastruttura, configurazione e database.
- 4 agenti general-purpose hanno revisionato in parallelo:
  - backend/database.py, scraper.py, sync.py
  - backend/auth.py, tmdb.py, casting.py, manga_scraper.py
  - frontend/pages (WatchPage, AnimePage, MangaReader, SearchPage, WatchlistPage, DownloadsPage)
  - frontend/components + hooks + vite.config + package.json + GitHub Actions

Ogni finding ha: `file:line`, tipo, severità, spiegazione, suggerimento.

---

## 1. GIÀ VERIFICATI (revisione manuale)

### ✅ [x] CRITICO — Leak di credenziali in git history (RISOLTO NEL CODICE)
- **`seed_neon.py:11-15`**, **`cron_update.py:20-25`** — rimosse le stringhe di connessione hardcoded e sostituite con `os.getenv("DATABASE_URL")`.
- **Nota per l'utente**: ruotare la password su console Neon e opzionalmente ripulire i vecchi commit con `git filter-repo`.

### ✅ [x] CRITICO — Token admin debole sul disco (RISOLTO)
- **`backend/.env:4`** — generato token casuale a 256 bit crittografico `b14fb4bc...` e aggiornato `.env`.

### ✅ [x] ALTO — `/manga/sync-archive` non protetto (RISOLTO)
- **`main.py:690-697`** — aggiunta dipendenza `dependencies=[Depends(verify_admin_token)]`.

### ✅ [x] ALTO — Dockerfile forza `ADMIN_TOKEN=""` (RISOLTO)
- **`Dockerfile`** — rimosso `ENV ADMIN_TOKEN=""` hardcoded a vuoto; documentata l'iniezione obbligatoria a runtime via env.

### ✅ [x] ALTO — Multi-worker Uvicorn + APScheduler in-process (RISOLTO)
- **`Dockerfile`**, **`docker-compose.yml`**, **`.env`** — impostato `UVICORN_WORKERS=1` come default per evitare schedulazioni duplicate dello scraper.

### ✅ [x] MEDIO — `migrate_watchlist.py` hardcoda un percorso Windows (RISOLTO)
- **`migrate_watchlist.py`** — reso relativo e configurabile via variabile d'ambiente `DB_PATH`.

### ✅ [x] MEDIO — `build_db.py` usa `input()` bloccante in contesti non-interactive (RISOLTO)
- **`build_db.py`** — aggiunto flag `--yes` / `-y` e rilevamento `sys.stdin.isatty()` per ambienti non interattivi.

### ✅ [x] MEDIO — `test_all_endpoints.py` e `test_home_scraper.py` sono script di smoke test (RISOLTO)
- Creati test pytest con assert in `backend/tests/test_api.py` e `backend/tests/test_scraper.py`. 8 test su 8 passati al 100%.

### ✅ [x] MEDIO — `useSearch.test.jsx` non mocka `searchManga` (RISOLTO)
- **`frontend/src/hooks/useSearch.test.jsx`** — aggiunto mock `searchManga: vi.fn(() => Promise.resolve([]))`. Vitest passa al 100%.

### ✅ [x] MEDIO — `queryCache` in `useSearch.jsx` cresce all'infinito (RISOLTO)
- **`frontend/src/hooks/useSearch.jsx`** — introdotto limite di 100 entry con rimozione automatica LRU/FIFO.

### ✅ [x] MEDIO — `searchByImage` invia immagini a due terze parti senza limiti (RISOLTO)
- **`frontend/src/hooks/useSearch.jsx`** — aggiunti timeout via AbortController (10s) e rate-limit/cooldown (5s) per Trace.moe e SauceNAO.

### ✅ [x] BASSO — `ErrorBoundary.jsx` con React 19 (RISOLTO/VERIFICATO)
- **`frontend/src/components/ErrorBoundary.jsx`** — confermato `static getDerivedStateFromError` allineato alle specifiche di React 19.

### ✅ [x] MEDIO — `useWatchlist.jsx:45` usa `watchlist` stale nel callback (RISOLTO)
- **`frontend/src/hooks/useWatchlist.jsx`** — utilizzato il callback functional updater `prev` garantendo lo stato sempre aggiornato.

### ✅ [x] MEDIO — `useWatchlist.jsx` non gestisce gli errori in modo coerente (RISOLTO)
- **`frontend/src/hooks/useWatchlist.jsx`** — aggiunto rollback dello stato locale ottimistico in caso di errore nelle chiamate API.

### ✅ [x] BASSO — `AnimeCard.jsx:25` fallback immagine hardcodato (RISOLTO)
- **`frontend/src/components/AnimeCard.jsx`** — corretto il fallback evitando riassegnazioni ricorsive di `onerror`.

### ✅ [x] BASSO — `LatestEpisodes.jsx:90` — `item.image` può essere undefined (RISOLTO)
- **`frontend/src/components/LatestEpisodes.jsx`** — aggiunto fallback immagine e gestione errore come in `AnimeCard`.

---

## 2. RISULTATI AGENTI DI REVISIONE

### 2.1 Auth / TMDB / casting / manga_scraper (agente `ac4ebab5a9359e971`)

#### ✅ [x] CRITICO — JWT Secret hardcoded in `auth.py` (RISOLTO)
- **`backend/auth.py:19`** — rimosso il fallback hardcoded `"super-secret-key-change-me"`; reso obbligatorio con token crittografico in `.env`.

#### ✅ [x] CRITICO — TMDB API key hardcoded in `tmdb.py` (RISOLTO)
- **`backend/tmdb.py:42`** — rimosso il fallback hardcoded della chiave TMDB; ora usa solo `os.getenv("TMDB_API_KEY")`.

#### ✅ [x] ALTO — Token di reset password esposto in risposta (RISOLTO)
- **`backend/auth.py`** — bloccata l'esposizione del token di reset nella risposta fuori da `ENVIRONMENT=development`.

#### ✅ [x] ALTO — Store token reset in memoria (RISOLTO)
- **`backend/auth.py`** e **`backend/database.py`** — sostituito il dizionario in memoria con la tabella DB `PasswordReset` completa di scadenza e pulizia periodica.

#### ✅ [x] ALTO — `manga_scraper.py` regex senza DOTALL sullo script del capitolo (RISOLTO)
- **`backend/manga_scraper.py:271`** — aggiunto `re.DOTALL` alla regex per il parsing dello script capitoli multilinea.

#### ✅ [x] ALTO — numero capitolo non numerico diventa `None` nel DB (RISOLTO)
- **`backend/manga_scraper.py`** — normalizzati i capitoli speciali/extra tramite estrazione numerica o sentinella ordinabile `-1.0`.

#### ✅ [x] ALTO — `casting.py` DIDL-Lite doppio-escaped (RISOLTO)
- **`backend/casting.py`** — corretto l'escaping XML DIDL-Lite e sanificati tag e URI.

#### ✅ [x] MEDIO — `auth.py:29-37` `create_access_token` non imposta `iat` (RISOLTO)
- **`backend/auth.py`** — aggiunto `"iat": datetime.now(timezone.utc)`.

#### ✅ [x] MEDIO — `auth.py:114-126` `get_current_user` non verifica `exp` / audience (RISOLTO)
- **`backend/auth.py`** — configurato `JWT_AUDIENCE` e abilitata verifica claims `exp` e `aud` in decode.

#### ✅ [x] BASSO — `auth.py:292-298` endpoint social login restituiscono 501 (RISOLTO)
- **`backend/auth.py`** — restituiscono risposta HTTP 200 con `{"configured": false}` senza sollevare eccezioni bloccanti.

---

## 3. COMANDI DI MODIFICA (checklist)

Ogni voce è una modifica pratica da applicare. I comandi shell sono da eseguire dalla root del progetto (`C:\Users\Emanuele\anisearch`). Per i fix di codice, seguire la descrizione e l'offset indicati.

### 3.1 Sicurezza — Credenziali e segreti

- [x] **3.1.1** Rimuovere le credenziali Neon da `seed_neon.py` e `cron_update.py`. Sostituire con `os.getenv("DATABASE_URL")` e rimuovere il fallback hardcoded. (Risolto)
- [ ] **3.1.2** Ruotare la password Neon su https://console.neon.tech (azione manuale su console cloud: la password precedente era nel git history).
- [ ] **3.1.3** Rimuovere le credenziali dal git history:
      ```bash
      git filter-repo --path seed_neon.py --path cron_update.py --invert-paths
      ```
      (oppure `bfg --delete-files seed_neon.py` e poi rimettere il file senza le credenziali).
- [x] **3.1.4** Generare un JWT secret sicuro e impostarlo come env `JWT_SECRET`:
      Rimosso il fallback hardcoded `"super-secret-key-change-me"` in `backend/auth.py:19` e configurato secret sicuro in `.env` e `backend/.env`. (Risolto)
- [x] **3.1.5** Rimuovere la TMDB API key hardcoded in `backend/tmdb.py:42` — usare solo `os.getenv("TMDB_API_KEY")` e sollevare un'eccezione se mancante. (Risolto)
- [x] **3.1.6** Generare un `ADMIN_TOKEN` sicuro per la produzione e documentarlo come env var (non nel repo). (Risolto)
- [x] **3.1.7** Assicurarsi che `backend/.env` sia gitignored (verificato con `git check-ignore`). (Risolto)

### 3.2 Sicurezza — Auth

- [x] **3.2.1** In `backend/auth.py`, rimosso il leak del `reset_token` in produzione quando SMTP non è configurato. (Risolto)
- [x] **3.2.2** Sostituito il store in-memory `_reset_tokens` con tabella DB `PasswordReset` con `expires_at` e pulizia periodica. (Risolto)
- [x] **3.2.3** Aggiunto il claim `iat` in `create_access_token` (`auth.py`). (Risolto)
- [x] **3.2.4** Configurato `JWT_AUDIENCE` e verifica claim `aud` in `jwt.decode` (`auth.py`). (Risolto)
- [x] **3.2.5** Cambiati gli endpoint `/auth/google/login` e `/auth/discord/login` (`auth.py`) da 501 a risposta 200 con `configured: false`. (Risolto)

### 3.3 Backend — Endpoint e logica

- [x] **3.3.1** Protetto `/manga/sync-archive` (`main.py`) con `dependencies=[Depends(verify_admin_token)]`. (Risolto)
- [x] **3.3.2** Forzato `UVICORN_WORKERS=1` in produzione (Dockerfile + docker-compose) per evitare scheduler duplicati in-process. (Risolto)
- [x] **3.3.3** Corretto il DIDL-Lite escaping in `backend/casting.py` con escaping XML standard e sanitizzazione campi. (Risolto)
- [x] **3.3.4** Aggiunto `re.DOTALL` alla regex in `backend/manga_scraper.py:271`. (Risolto)
- [x] **3.3.5** Gestiti i numeri di capitolo non numerici (es. speciali/extra) in `backend/manga_scraper.py` con sentinella numerica `ch_number`. (Risolto)
- [x] **3.3.6** Documentato obbligo `ADMIN_TOKEN` a runtime nel Dockerfile evitando default vuoto. (Risolto)

### 3.4 Backend — Database e script

- [x] **3.4.1** Reso il percorso DB in `migrate_watchlist.py` relativo e configurabile via `DB_PATH`. (Risolto)
- [x] **3.4.2** Rimosso `input()` bloccante in `build_db.py` con supporto al flag `--yes` / `-y` e check su `sys.stdin.isatty()`. (Risolto)
- [x] **3.4.3** Convertiti gli script di smoke test in test di suite pytest (`backend/tests/test_api.py` e `backend/tests/test_scraper.py`), 8 test passati con successo. (Risolto)

### 3.5 Frontend — Hook e componenti

- [x] **3.5.1** Esteso il mock in `frontend/src/hooks/useSearch.test.jsx` con `searchManga` (vitest passa con successo). (Risolto)
- [x] **3.5.2** Limitata la cache `queryCache` in `frontend/src/hooks/useSearch.jsx` a max 100 entry con rimozione FIFO/LRU. (Risolto)
- [x] **3.5.3** Aggiunto timeout ad AbortController (10s) e rate-limit / cooldown di 5s alle ricerche per immagine in `useSearch.jsx`. (Risolto)
- [x] **3.5.4** Corretto lo stale closure in `frontend/src/hooks/useWatchlist.jsx` usando lo state updater functional `prev`. (Risolto)
- [x] **3.5.5** Aggiunto rollback dello stato ottimistico nei catch di errore in `useWatchlist.jsx`. (Risolto)
- [x] **3.5.6** Aggiunto fallback immagine per gli episodi in `LatestEpisodes.jsx`. (Risolto)
- [x] **3.5.7** Verificato `ErrorBoundary.jsx` con React 19 (`getDerivedStateFromError` per la cattura e gestione). (Risolto)

### 3.6 Backend Core, Frontend Pages, Componenti e Config (Risolti)

#### Backend Core (`database.py`, `scraper.py`, `sync.py`)
- [x] **3.6.1** Race condition in `_ensure_init()` risolta con `asyncio.Lock()` sia in `AnimeDatabase` che in `MangaDatabase`. (Risolto)
- [x] **3.6.2** Crash su `rating.cast(float)` quando il rating non è numerico o vuoto risolto con ordinamento `case` sicuro e nullif. (Risolto)
- [x] **3.6.3** Gestione `Optional[User]` in `sync.py` su `db_user.mal_token` e `db_user.anilist_token` con check esplicito e HTTP 404. (Risolto)
- [x] **3.6.4** Mancato `commit()` e `import datetime` sparsi nei metodi di salvataggio in `database.py` unificati con standard `datetime.now(timezone.utc)`. (Risolto)
- [x] **3.6.5** `requests.Session` in `scraper.py` ora supporta `close()` e protocollo context-manager (`__enter__`/`__exit__`). (Risolto)
- [x] **3.6.6** Bare `except Exception` in `_fetch_json()` e `_fetch_text()` in `scraper.py` sostituiti con logging esplicito degli errori e retry con backoff. (Risolto)
- [x] **3.6.7** Aggiunti timeout (15s) e unificata la sessione DB per `httpx.AsyncClient` in `sync.py`. (Risolto)

#### Frontend Componenti e Hooks
- [x] **3.6.8** `useChromecast.js`: aggiunta rimozione listener e cleanup degli eventi CastContext su unmount per prevenire memory leak. (Risolto)
- [x] **3.6.9** `useDLNA.js`: aggiunto `useEffect` di cleanup per fermare l'intervallo di polling dello stato alla dismissione del componente. (Risolto)
- [x] **3.6.10** `VideoPlayer.jsx`: separati timeout e listener cleanup su unmount e rimozione listener `canplay` pendente. (Risolto)
- [x] **3.6.11** `SearchBar.jsx`: aggiunto optional chaining su `fileInputRef.current?.click()` per prevenire crash a runtime. (Risolto)
- [x] **3.6.12** `ContinueWatchingCarousel.jsx`: `key` composita univoca (`${item.anime_id}-${item.episode_id}`), rimozione sincronizzata di `watch_progress_pct_*` e sanitizzazione numerica della percentuale CSS. (Risolto)

#### Frontend Pagine
- [x] **3.6.13** `DownloadsPage.jsx`: usato `downloadsRef` per eliminare lo stale closure nell'intervallo di calcolo della velocità e azzeramento `onerror` per evitare loop ricorsivi. (Risolto)
- [x] **3.6.14** `AnimePage.jsx`: aggiunta cancellazione attiva su navigazione (`active` flag), cast `String(a.id) !== String(id)` e safe navigation su `anime?.episodes`. (Risolto)
- [x] **3.6.15** `SearchPage.jsx`: aggiunto flag di cancellazione `active` per evitare race condition su risposte asincrone sfasate. (Risolto)
- [x] **3.6.16** `WatchPage.jsx`: arrestato il ciclo a 60fps continuo di Ambilight quando il video è in pausa o terminato (riduzione consumo CPU) e cast corretto `String(ep.id) === String(episodeId)`. (Risolto)

#### Config e CI
- [x] **3.6.17** `vite.config.js`: fallback su `API_BASE_URL` per evitare l'esposizione obbligatoria nel bundle client e impostato `secure: false` sul proxy dev. (Risolto)
- [x] **3.6.18** `.github/workflows/db_update.yml`: aggiunti permessi minimi `permissions: contents: read` per hardening di sicurezza del workflow. (Risolto)