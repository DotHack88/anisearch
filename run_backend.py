#!/usr/bin/env python
"""
AniSearch — Backend launcher
Avvia uvicorn con force-reload del modulo principale.
Il TMDB router è ora in backend/tmdb.py (modulo separato) quindi non
risente del problema di caching bytecode di Uvicorn su Windows.
"""
import os
import sys
import shutil
from pathlib import Path

# Cancella __pycache__ per evitare problemi di bytecode su Windows
root = Path(__file__).resolve().parent
for pycache in root.rglob("__pycache__"):
    shutil.rmtree(pycache, ignore_errors=True)

# Assicura che il path sia corretto
sys.path.insert(0, str(root))

# Import fresco del modulo backend
for mod in list(sys.modules.keys()):
    if mod.startswith("backend"):
        del sys.modules[mod]

from backend.main import app  # noqa: E402

# Verifica route registrate
routes = [r.path for r in app.routes if hasattr(r, "path")]
print(f"[Backend Launcher] {len(routes)} route registrate totali")
tmdb_routes = [r for r in routes if "tmdb" in r]
if tmdb_routes:
    print(f"[Backend Launcher] TMDB route trovate: {tmdb_routes}")
else:
    print("[Backend Launcher] ATTENZIONE: Nessuna TMDB route trovata!")

# Avvia Uvicorn
import uvicorn
uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
