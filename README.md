<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.14+-3776AB?logo=python&logoColor=white&style=for-the-badge" />
</p>

# 🔍 AniSearch

**Cerca, sfoglia e guarda anime e manga** con ricerca in tempo reale, catalogo filtrabile, riproduzione video nativa, reader manga integrato, tracciamento completo della visione/lettura e visione di gruppo sincronizzata (Watch Party).

---

## ✨ Funzionalità Attuali

### 🎬 Anime
- 🔎 **Ricerca Istantanea**: Autocomplete in tempo reale con navigazione da tastiera.
- 📚 **Catalogo Completo**: Migliaia di anime indicizzati con filtri per genere/anno/stato.
- ▶️ **Player Video Avanzato**: 
  - Riproduzione diretta degli episodi.
  - Sincronizzazione precisa dei progressi (riprendi la visione all'istante da dove avevi interrotto).
  - Modalità Cinema, Effetto Ambilight, e scorciatoie da tastiera.
  - Skip Sigla/Finale automatico.
- 👥 **Watch Party (Visione di Gruppo)**: Guarda gli episodi sincronizzati con i tuoi amici. L'Host ha il pieno controllo della riproduzione, mentre per gli Ospiti il player è automaticamente sincronizzato e blindato per evitare scatti o desincronizzazioni (gestione automatica del mute in caso di blocco dell'autoplay del browser).
- 📺 **Trasmissione TV**: Supporto per Google Cast (Chromecast).
- 📥 **Download**: Download rapido degli episodi per la visione offline.
- 📋 **Watchlist e Preferiti**: Gestione della propria lista personale (da guardare, in corso, completato) e storico "Continua a Guardare" con possibilità di rimuovere singole serie in corso.

### 📖 Manga
- 📚 **Catalogo Manga**: Ricerca e consultazione dell'intero archivio (grazie all'integrazione scraping).
- 📖 **Reader Manga Integrato**: Lettura fluida dei capitoli direttamente nel sito.
- 🔖 **Sincronizzazione Lettura**: Tracciamento dei progressi per i manga ("Continua a Leggere"), con funzionalità per cancellare la cronologia in caso di interruzione della lettura.
- 📋 **Watchlist Manga**: Gestione dello stato dei manga (da leggere, in corso, completato) e salvataggio preferiti.

### ☁️ Cloud & Sync
- 🔄 **Multi-Dispositivo**: Esporta e importa un codice segreto univoco per condividere il profilo ovunque.
- 🔔 **Notifiche Push**: Iscrizione per ricevere notifiche su nuovi episodi o capitoli (supporto VAPID).

---

## 🛠️ Aggiornamenti Recenti

- **Sincronizzazione Progressi**: Sostituito l'evento `loadedmetadata` con l'evento `canplay` nel player video per garantire un ripristino istantaneo e affidabile del timestamp di visione (evitando race-condition o buffering infinito).
- **Controllo Cronologia**: Aggiunta la rimozione manuale degli elementi in "Continua a Guardare" (Anime) e "Continua a Leggere" (Manga) tramite interfaccia grafica e integrazione API back-end (`DELETE /manga-watch/{manga_id}`).
- **Watch Party Sincronizzato**: Risolto il problema del "riproduzione asincrona" per gli ospiti disabilitando i comandi play/pause client-side, gestendo l'autoplay blocking dei browser tramite mute automatico e implementando una tolleranza di 2s (anti-stutter) nelle chiamate WebSocket `sync` per impedire sfasamenti e scatti continui.
- **UI Pulita**: Offuscamento dei riferimenti esterni nella UI in caso di errore di connettività ("Apri Sorgente Originale").

---

## 📅 Sviluppi Futuri e Prossima Sfida

### 🎯 La Prossima Sfida (In Corso)
Attualmente i piani di sviluppo si stanno concentrando su **Integrazioni Esterne e Sistema Account**:
- **Area Login completa**: Creazione di un sistema di autenticazione sicuro (JWT) per sostituire i profili anonimi basati su sessione.
- **Sincronizzazione MyAnimeList (MAL) & AniList**: Permettere agli utenti di collegare i propri account esterni per mantenere la propria Watchlist costantemente aggiornata su tutte le piattaforme in modo automatico. (Supporto OAuth2).

### 🚀 Altri Piani in Programma
- **Miglioramenti Reader Manga**:
  - Modalità di lettura ottimizzate (scorrimento orizzontale vs verticale).
  - Pre-fetching intelligente delle immagini per velocizzare i cambi pagina, anche in caso di connessione instabile.
- **Supporto Multi-Lingua / Multi-Sorgente**: Permettere allo scraper di variare dinamicamente le fonti video per ampliare l'offerta dei contenuti (es. switch ai server di backup in caso di blocchi timeout).
- **Raccomandazioni AI**: Implementazione di un motore AI / Semantico per suggerire anime basati su pattern di visione.

---

## 🏗️ Architettura

```
anisearch/
├── backend/                   # API Python + Scraper
│   ├── main.py                # Server FastAPI REST + WebSockets (Watch Party)
│   ├── database.py            # SQLModel (SQLite/Postgres) per Anime/Manga/Progress/Watchlist
│   ├── scraper.py             # Scraper anime 
│   ├── manga_scraper.py       # Scraper manga
│   └── tmdb.py                # Integrazione metadati TMDB
├── frontend/                  # UI React + Vite
│   ├── src/
│   │   ├── pages/             # Pagine: Home, WatchPage, MangaReader, Watchlist
│   │   ├── components/        # Componenti: VideoPlayer, WatchPartyPanel, ecc.
│   │   └── utils/             # API handler, session manager, sync WebSocket
│   └── vite.config.js         # Configurazione proxy per dev locale
└── build_db.py                # Script batch per popolamento massivo del database
```

---

## 🚀 Avvio Rapido

### Backend
Dalla cartella `/backend`:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
Dalla cartella `/frontend`:
```bash
npm install
npm run dev
```

L'ambiente di sviluppo si avvierà su `http://localhost:5173`. Le chiamate API verso `/api` saranno reindirizzate automaticamente al backend sulla porta 8000.
