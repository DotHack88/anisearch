<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white&style=for-the-badge" />
</p>

# 🔍 AniSearch

**Cerca, sfoglia e guarda anime da AnimeWorld** con ricerca in tempo reale, catalogo filtrabile, riproduzione video nativa e tracciamento della visione.

---

## ✨ Funzionalità

| Feature | Descrizione |
|---|---|
| 🔎 **Ricerca Istantanea** | Autocomplete in tempo reale con navigazione da tastiera (↑↓ Enter Esc) |
| 📚 **Catalogo Completo** | 6.500+ anime indicizzati con paginazione, filtri per genere/anno/stato e ordinamento |
| ▶️ **Player Video Nativo** | Riproduzione diretta degli episodi con navigazione precedente/successivo |
| 🔄 **Riprendi la Visione** | Salvataggio automatico del progresso — riprendi da dove avevi interrotto |
| ❤️ **Preferiti** | Salva i tuoi anime preferiti in locale (localStorage) |
| 🕐 **Aggiornamento Automatico** | Scheduler che controlla nuovi episodi ogni 60 minuti |
| 🐳 **Docker Ready** | Dockerfile incluso per il deploy containerizzato |

---

## 🏗️ Architettura

```
anisearch/
├── backend/                  # API Python + Scraper
│   ├── main.py               # FastAPI — server API REST
│   ├── scraper.py             # Scraper AnimeWorld (A-Z + tooltip metadata)
│   ├── database.py            # SQLite — anime, episodi, watch progress
│   ├── cache.py               # Redis caching helper (opzionale)
│   ├── requirements.txt       # Dipendenze Python
│   └── anisearch.db           # Database SQLite (generato)
├── frontend/                 # UI React
│   ├── src/
│   │   ├── App.jsx            # Router principale
│   │   ├── pages/
│   │   │   ├── Home.jsx       # Homepage con ricerca, riprendi visione, preferiti
│   │   │   ├── CatalogPage.jsx# Catalogo paginato con filtri
│   │   │   ├── AnimePage.jsx  # Dettaglio anime con episodi
│   │   │   ├── WatchPage.jsx  # Player video con navigazione episodi
│   │   │   └── FavoritesPage.jsx
│   │   ├── components/
│   │   │   ├── SearchBar.jsx  # Barra di ricerca con autocomplete
│   │   │   ├── AnimeCard.jsx  # Card anime riutilizzabile
│   │   │   ├── EpisodeList.jsx# Griglia episodi
│   │   │   └── Navbar.jsx     # Navigazione globale
│   │   ├── hooks/
│   │   │   ├── useFavorites.js# Hook per gestione preferiti (localStorage)
│   │   │   └── useSearch.js   # Hook per ricerca debounced
│   │   └── utils/
│   │       └── api.js         # Client API (Axios)
│   ├── vite.config.js         # Configurazione Vite con proxy API
│   └── package.json
├── build_db.py               # Script per popolare il database da zero
├── Dockerfile                # Container Docker per il deploy
└── README.md
```

---

## 🚀 Avvio Rapido

### Prerequisiti

- **Python 3.11+**
- **Node.js 18+** e npm
- (Opzionale) **Redis** per il caching delle ricerche

### 1. Backend

```bash
# Dalla root del progetto
cd backend
pip install -r requirements.txt

# Torna alla root per avviare il server
cd ..
uvicorn backend.main:app --reload --port 8000
```

> ⚠️ **Importante:** il server va avviato dalla **root del progetto**, non dalla cartella `backend/`.
> Al primo avvio con database vuoto, lo scraping completo parte automaticamente (~8-10 minuti).

### 2. Frontend (nuovo terminale)

```bash
cd frontend
npm install
npm run dev
```

### 3. Apri il browser

Vai su **http://localhost:5173** — il proxy Vite inoltrerà le chiamate API a `localhost:8000`.

---

## 📡 API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/status` | Stato del server e conteggio anime |
| `GET` | `/search?q=...&limit=20` | Ricerca anime per titolo |
| `GET` | `/catalog?page=0&per_page=50&sort=title&genre=...&status=...&year=...&search=...` | Catalogo paginato con filtri |
| `GET` | `/filters` | Lista generi, anni e stati disponibili |
| `GET` | `/anime/{anime_id}` | Dettaglio anime con lista episodi |
| `GET` | `/episode/{episode_id}/video` | URL diretto del flusso video |
| `GET` | `/new?limit=20` | Ultimi episodi aggiunti |
| `GET` | `/watch` | Lista progressi visione recenti |
| `GET` | `/watch/{anime_id}` | Ultimo episodio visto per un anime |
| `POST` | `/watch/{anime_id}?episode_id=...` | Salva progresso visione |
| `POST` | `/cache/refresh` | Ricostruisce il database da zero |
| `GET` | `/debug/page/{letter}` | Debug struttura HTML pagina A-Z |

---

## 🗄️ Database

Il database SQLite (`backend/anisearch.db`) contiene tre tabelle:

| Tabella | Descrizione |
|---------|-------------|
| `anime` | Catalogo completo (id, titolo, url, immagine, tipo, stato, anno, rating, generi) |
| `episodes` | Episodi associati ad ogni anime |
| `watch_progress` | Ultimo episodio visto per anime (tracciamento visione) |

### Ricostruire il Database

Per ripopolare o aggiornare manualmente il database con l'intero catalogo:

```bash
# Dalla root del progetto
python build_db.py
```

Lo script pulisce il DB e avvia lo scraping completo di tutte le pagine A-Z con arricchimento metadati. Richiede circa **8-10 minuti** e indicizza **6.500+ anime**.

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
- **BeautifulSoup4** — Parsing HTML per lo scraping
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

- Lo scraping funziona **solo da IP residenziale** (AnimeWorld blocca IP di datacenter/VPN).
- Il primo avvio richiede alcuni minuti per popolare il database completo.
- I flussi video vengono recuperati in tempo reale tramite le API di AnimeWorld — la disponibilità dipende dal sito sorgente.
- Redis è **opzionale**: se non disponibile, l'app funziona normalmente senza caching.

---

## 📄 Licenza

Progetto a uso personale ed educativo.
