<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white&style=for-the-badge" />
</p>

# 🔍 AniSearch

**Cerca, sfoglia e guarda anime** con ricerca in tempo reale, catalogo filtrabile, riproduzione video nativa e tracciamento della visione.

---

## ✨ Funzionalità

| Feature | Descrizione |
|---|---|
| 🔎 **Ricerca Istantanea** | Autocomplete in tempo reale con navigazione da tastiera (↑↓ Enter Esc) |
| 📚 **Catalogo Completo** | 6.500+ anime indicizzati con paginazione, filtri per genere/anno/stato e ordinamento |
| ▶️ **Player Video Nativo** | Riproduzione diretta degli episodi con navigazione precedente/successivo |
| 🔄 **Sincronizzazione Multi-Dispositivo** | Esporta e importa un codice segreto univoco per condividere il tuo profilo su smartphone, tablet e PC. |
| 📺 **Riprendi la Visione** | Salvataggio automatico sul cloud del progresso — riprendi da dove avevi interrotto su qualsiasi dispositivo. |
| ❤️ **Preferiti Cloud** | Salva i tuoi anime preferiti sul tuo profilo remoto e trovali ovunque. |
| 🕐 **Aggiornamento Automatico** | Scheduler che controlla nuovi episodi ogni 60 minuti |
| ☁️ **Cloud Ready** | Pronto per il deploy separato (Vercel per il Frontend, Render per il Backend) |

---

## 🏗️ Architettura

```
anisearch/
├── backend/                  # API Python + Scraper
│   ├── main.py               # FastAPI — server API REST
│   ├── scraper.py             # Scraper  (A-Z + tooltip metadata)
│   ├── database.py            # SQLite/PostgreSQL — anime, episodi, watch progress, favoriti
│   ├── cache.py               # Redis caching helper (opzionale)
│   ├── requirements.txt       # Dipendenze Python
│   └── anisearch.db           # Database SQLite (in sviluppo locale)
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
│   │   │   ├── SyncModal.jsx  # Modale per sincronizzazione codice profilo
│   │   │   ├── SearchBar.jsx  # Barra di ricerca con autocomplete
│   │   │   ├── AnimeCard.jsx  # Card anime riutilizzabile
│   │   │   ├── EpisodeList.jsx# Griglia episodi
│   │   │   └── Navbar.jsx     # Navigazione globale
│   │   ├── hooks/
│   │   │   ├── useFavorites.jsx # Hook per gestione preferiti via API (cloud)
│   │   │   └── useSearch.jsx    # Hook per ricerca debounced
│   │   └── utils/
│   │       ├── api.ts         # Client API (Axios) con proxy detection
│   │       └── session.ts     # Gestione dell'X-Session-Id in localStorage
│   ├── vite.config.js         # Configurazione Vite con proxy API verso il Cloud
│   └── vercel.json            # Configurazione proxy per il deploy frontend
├── build_db.py               # Script per popolare il database da zero
├── Dockerfile                # Container Docker per il deploy backend
└── README.md
```

---

## 🚀 Avvio Rapido (Sviluppo Locale)

### Prerequisiti

- **Python 3.11+**
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
| `GET` | `/favorites` | Ritorna la lista degli anime tra i preferiti |
| `POST` | `/favorites/{anime_id}` | Aggiunge un anime ai preferiti |
| `DELETE` | `/favorites/{anime_id}` | Rimuove un anime dai preferiti |
| `POST` | `/sync-catalog` | Avvia il job per sincronizzare l'intero catalogo |

---

## 🗄️ Database e Deploy

Il database utilizza SQLModel, compatibile sia con SQLite (locale) che PostgreSQL (in produzione su Render). 
Tabelle principali:

| Tabella | Descrizione |
|---------|-------------|
| `anime` | Catalogo completo (id, titolo, url, immagine, tipo, stato, anno, rating, generi) |
| `episode` | Episodi associati ad ogni anime |
| `watchprogress`| Tracciamento visione (join con Anime e Episode) basato su `session_id` |
| `favorite` | Tracciamento preferiti basato su `session_id` |

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

- Lo scraping funziona **solo da IP residenziale** 
- Il primo avvio richiede alcuni minuti per popolare il database completo.
- I flussi video vengono recuperati in tempo reale tramite le API  — la disponibilità dipende dal sito sorgente.
- Redis è **opzionale**: se non disponibile, l'app funziona normalmente senza caching.

---

## 📄 Licenza

Progetto a uso personale ed educativo.
