# AniSearch

Cerca e guarda anime da AnimeWorld con autocomplete in tempo reale.

## Avvio rapido

### Backend
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (nuovo terminale)
```
cd frontend
npm install
npm run dev
```

Apri: http://localhost:5173

> Il backend impiega 2-3 minuti all'avvio per scaricare la lista anime da AnimeWorld.
> Lo scraping funziona SOLO da IP residenziale (non da server cloud).
