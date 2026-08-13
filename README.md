<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.14+-3776AB?logo=python&logoColor=white&style=for-the-badge" />
</p>

# 🔍 AniSearch

**Cerca, sfoglia e guarda anime e manga** con ricerca in tempo reale, catalogo filtrabile, riproduzione video nativa, reader manga integrato e tracciamento completo della visione/lettura.

---

## ✨ Funzionalità

### 🎬 Anime
| Feature | Descrizione |
|---|---|
| 🔎 **Ricerca Istantanea** | Autocomplete in tempo reale con navigazione da tastiera (↑↓ Enter Esc) |
| 📚 **Catalogo Completo** | 6.500+ anime indicizzati con paginazione, filtri per genere/anno/stato e ordinamento |
| ▶️ **Player Video Nativo** | Riproduzione diretta degli episodi con navigazione precedente/successivo |
| 🕐 **Nuovi Episodi** | Pagina dedicata agli ultimi episodi aggiunti |
| 📥 **Download** | Pagina download episodi per visione offline |
| 📋 **Watchlist Anime** | Lista personale (da guardare, in corso, completato, abbandonato) con note e contatore episodi |

### 📖 Manga *(nuovo)*
| Feature | Descrizione |
|---|---|
| 📚 **Catalogo Manga** | Sfoglia e cerca manga con filtri per genere/stato/anno tramite MangaWorld |
| 🔖 **Dettaglio Manga** | Pagina completa con info, capitoli e metadati |
| 📖 **Reader Manga** | Lettura capitoli inline con navigazione pagine e capitoli |
| 📋 **Watchlist Manga** | Lista lettura personale (da leggere, in corso, completato) con contatore capitoli e note |

### ☁️ Cloud & Sync
| Feature | Descrizione |
|---|---|
| 🔄 **Sincronizzazione Multi-Dispositivo** | Esporta e importa un codice segreto univoco per condividere il profilo su qualsiasi dispositivo |
| 📺 **Riprendi la Visione** | Salvataggio automatico del progresso — riprendi da dove avevi interrotto |
| ❤️ **Preferiti Cloud** | Salva anime e manga preferiti sul profilo remoto |
| ☁️ **Cloud Ready** | Pronto per il deploy separato (Vercel per il Frontend, Render per il Backend) |

---

## 🏗️ Architettura

```
anisearch/
├── backend/                   # API Python + Scraper
│   ├── main.py                # FastAPI — server API REST (anime + manga)
│   ├── scraper.py             # Scraper anime AnimeWorld (A-Z + tooltip metadata)
│   ├── manga_scraper.py       # Scraper manga MangaWorld            ← nuovo
│   ├── database.py            # SQLite/PostgreSQL — AnimeDatabase + MangaDatabase
│   ├── tmdb.py                # Integrazione TMDB per metadati aggiuntivi
│   ├── cache.py               # Redis caching helper (opzionale)
│   └── requirements.txt       # Dipendenze Python
├── frontend/                  # UI React
│   ├── src/
│   │   ├── App.jsx            # Router principale
│   │   ├── pages/
│   │   │   ├── Home.jsx            # Homepage con ricerca, riprendi visione, preferiti
│   │   │   ├── CatalogPage.jsx     # Catalogo anime paginato con filtri
│   │   │   ├── AnimePage.jsx       # Dettaglio anime con episodi
│   │   │   ├── WatchPage.jsx       # Player video con navigazione episodi
│   │   │   ├── WatchlistPage.jsx   # Watchlist anime (da guardare/in corso/completato)
│   │   │   ├── FavoritesPage.jsx   # Preferiti anime
│   │   │   ├── NewEpisodesPage.jsx # Ultimi episodi aggiunti
│   │   │   ├── DownloadsPage.jsx   # Download episodi                ← nuovo
│   │   │   ├── MangaList.jsx       # Catalogo manga                  ← nuovo
│   │   │   ├── MangaDetail.jsx     # Dettaglio manga + capitoli      ← nuovo
│   │   │   └── MangaReader.jsx     # Reader manga inline             ← nuovo
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigazione globale (anime + manga)
│   │   │   ├── SearchBar.jsx       # Barra di ricerca con autocomplete
│   │   │   ├── AnimeCard.jsx       # Card anime riutilizzabile
│   │   │   ├── EpisodeList.jsx     # Griglia episodi
│   │   │   └── SyncModal.jsx       # Modale sincronizzazione profilo
│   │   ├── hooks/
│   │   │   ├── useFavorites.jsx    # Hook preferiti via API (cloud)
│   │   │   └── useSearch.jsx       # Hook ricerca debounced
│   │   └── utils/
│   │       ├── api.ts              # Client API (Axios) con proxy detection
│   │       └── session.ts          # Gestione X-Session-Id in localStorage
│   ├── vite.config.js         # Configurazione Vite con proxy API verso il Cloud
│   └── vercel.json            # Configurazione proxy per il deploy frontend
├── build_db.py                # Script per popolare il database da zero
├── cron_update.py             # Aggiornamento periodico catalogo
├── parse_chapter.py           # Utility per parsing struttura capitoli manga
├── Dockerfile                 # Container Docker per il deploy backend
└── README.md
```

---

## 🚀 Avvio Rapido (Sviluppo Locale)

### Prerequisiti

- **Python 3.14+**
- **Node.js 18+** e npm

### Avvio Veloce Frontend (collegato a Render Cloud)

Se il backend è già hostato su Render, ti basta avviare il frontend:

```bash
cd frontend
npm install
npm run dev
```
Vai su **http://localhost:5173** — le chiamate API andranno in automatico sul server di produzione grazie al proxy in `vite.config.js`.

### Sviluppo Full-Stack (Backend Locale)

Se vuoi modificare anche il backend, avvialo localmente:
```bash
# Dalla root del progetto
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```
*(Ricordati di modificare temporaneamente il proxy di `vite.config.js` per puntare a `localhost:8000` invece di Render).*

---

## 📡 API Endpoints

Il backend riconosce gli utenti tramite l'header `X-Session-Id` e salva progressi/preferiti nel DB.

### 🎬 Anime

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/status` | Stato del server e conteggio anime |
| `GET` | `/search?q=...&limit=20` | Ricerca anime per titolo |
| `GET` | `/catalog?page=0...` | Catalogo paginato con filtri |
| `GET` | `/anime/{anime_id}` | Dettaglio anime con lista episodi |
| `GET` | `/episode/{id}/video` | URL diretto del flusso video |
| `GET` | `/new?limit=20` | Ultimi episodi aggiunti |
| `GET` | `/watch` | Lista progressi visione recenti (per la sessione) |
| `GET` | `/watch/{anime_id}` | Ultimo episodio visto per un anime |
| `POST` | `/watch/{anime_id}?episode_id=...` | Salva progresso visione |
| `GET` | `/favorites` | Lista degli anime preferiti |
| `POST` | `/favorites/{anime_id}` | Aggiunge un anime ai preferiti |
| `DELETE` | `/favorites/{anime_id}` | Rimuove un anime dai preferiti |
| `GET` | `/watchlist` | Lista watchlist anime della sessione |
| `GET` | `/watchlist/stats` | Statistiche watchlist anime |
| `POST` | `/watchlist/{anime_id}` | Aggiunge/aggiorna anime nella watchlist |
| `PUT` | `/watchlist/{anime_id}` | Aggiorna stato/progresso anime in watchlist |
| `DELETE` | `/watchlist/{anime_id}` | Rimuove anime dalla watchlist |
| `POST` | `/sync-catalog` | Avvia il job per sincronizzare l'intero catalogo |

### 📖 Manga *(nuovo)*

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/manga/search?q=...` | Ricerca manga per titolo |
| `GET` | `/manga/catalog` | Catalogo manga paginato con filtri |
| `GET` | `/manga/{manga_id}` | Dettaglio manga con lista capitoli |
| `GET` | `/manga/{manga_id}/chapters` | Lista capitoli di un manga |
| `GET` | `/manga/chapter/{chapter_id}/pages` | Pagine di un capitolo (URL immagini) |
| `GET` | `/manga-favorites` | Lista manga preferiti |
| `POST` | `/manga-favorites/{manga_id}` | Aggiunge un manga ai preferiti |
| `DELETE` | `/manga-favorites/{manga_id}` | Rimuove un manga dai preferiti |
| `GET` | `/manga-watchlist` | Lista watchlist manga della sessione |
| `POST` | `/manga-watchlist/{manga_id}` | Aggiunge/aggiorna manga nella watchlist |
| `PUT` | `/manga-watchlist/{manga_id}` | Aggiorna stato/capitoli letti |
| `DELETE` | `/manga-watchlist/{manga_id}` | Rimuove manga dalla watchlist |

---

## 🗄️ Database e Deploy

Il database utilizza SQLModel, compatibile sia con SQLite (locale) che PostgreSQL (in produzione su Render).  
Tabelle principali:

| Tabella | Descrizione |
|---------|-------------|
| `anime` | Catalogo completo anime (id, titolo, url, immagine, tipo, stato, anno, rating, generi) |
| `episode` | Episodi associati ad ogni anime |
| `watchprogress` | Tracciamento visione (join con Anime e Episode) basato su `session_id` |
| `favorite` | Preferiti anime basati su `session_id` |
| `watchlist` | Watchlist anime con stato, episodi visti e note |
| `manga` | Catalogo manga (id, titolo, url, immagine, tipo, stato, anno, generi) ← nuovo |
| `mangachapter` | Capitoli associati ad ogni manga ← nuovo |
| `mangafavorite` | Preferiti manga basati su `session_id` ← nuovo |
| `mangawatchlist` | Watchlist manga con stato, capitoli letti e note ← nuovo |

---

## 🐳 Docker

```bash
# Build
docker build -t anisearch .

# Run
docker run -p 8000:8000 anisearch
```

Il container espone l'API su porta `8000`. Configura la variabile d'ambiente `REDIS_URL` per abilitare il caching opzionale.

---

## 🛠️ Stack Tecnologico

### Backend
- **FastAPI** — API REST ad alte prestazioni
- **BeautifulSoup4** — Parsing HTML per lo scraping (AnimeWorld + MangaWorld)
- **SQLite** — Database embedded, zero configurazione
- **APScheduler** — Job periodico per aggiornamento episodi
- **Redis** — Caching opzionale delle ricerche (5 min TTL)

### Frontend
- **React 18** — UI component-based
- **React Router 6** — Navigazione SPA
- **Vite 5** — Build tool ultra-veloce con HMR
- **TailwindCSS 3** — Utility-first CSS framework
- **Axios** — Client HTTP

---

## ⚠️ Note Importanti

- Lo scraping funziona **solo da IP residenziale**
- Il primo avvio richiede alcuni minuti per popolare il database completo.
- I flussi video vengono recuperati in tempo reale tramite le API — la disponibilità dipende dal sito sorgente.
- Redis è **opzionale**: se non disponibile, l'app funziona normalmente senza caching.

---

## 📄 Licenza

Progetto a uso personale ed educativo.
