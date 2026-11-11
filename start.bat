@echo off
title AniSearch Launcher
echo ===================================================
echo                Avvio AniSearch
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo [1/2] Avvio del Backend FastAPI (porta 8000)...
if exist ".venv\Scripts\python.exe" (
    start "AniSearch - Backend" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000"
) else if exist "venv\Scripts\python.exe" (
    start "AniSearch - Backend" cmd /k "venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000"
) else (
    start "AniSearch - Backend" cmd /k "python -m uvicorn backend.main:app --reload --port 8000"
)

echo [2/2] Avvio del Frontend Vite (porta 5173)...
start "AniSearch - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo AniSearch e' in fase di esecuzione!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo ===================================================
echo Per arrestare AniSearch, chiudi le due finestre del terminale.
echo.
timeout /t 5 >nul
