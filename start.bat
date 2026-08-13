@echo off
echo ===================================================
echo                Avvio AniSearch
echo ===================================================
echo.

echo [1/2] Avvio del Backend (FastAPI)...
start "AniSearch - Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

echo [2/2] Avvio del Frontend (React/Vite)...
start "AniSearch - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo AniSearch e' in esecuzione! 
echo Frontend: http://localhost:5173
echo Backend: http://127.0.0.1:8000
echo.
echo Per fermare il programma, chiudi le due finestre del terminale aperte.
pause
