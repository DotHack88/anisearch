# AniSearch

Cerca e guarda anime da AnimeWorld con autocomplete in tempo reale.

## Avvio rapido

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (nuovo terminale)
```bash
cd frontend
npm install
npm run dev
```

Apri: http://localhost:5173

> Il backend impiega 2-3 minuti all'avvio per scaricare la lista anime da AnimeWorld.
> Lo scraping funziona SOLO da IP residenziale (non da server cloud).

## Database & Scraping

Se si desidera ripopolare o aggiornare manualmente il database (ad esempio per caricare l'intero catalogo o per forzare l'aggiornamento), è possibile eseguire lo script di popolamento nella root del progetto:

```bash
python build_db.py
```

Questo pulirà il database locale e avvierà lo scraping completo di tutte le pagine A-Z arricchendole con i metadati (generi, anno, valutazione, stato). Il database SQLite si trova in `backend/anisearch.db`.
