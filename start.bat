@echo off
REM ============================================================
REM  UniMate - Start (development)
REM  Launches the FastAPI backend and the Vite frontend.
REM  Run install.bat first if you haven't already.
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "backend\.venv" (
    echo Dependencies not found. Running install.bat first...
    call install.bat
)

echo.
echo Starting UniMate...
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.

start "UniMate Backend" cmd /k "cd /d "%CD%" && call backend\.venv\Scripts\activate.bat && uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

start "UniMate Frontend" cmd /k "cd /d "%CD%" && npm run dev"

echo Two windows opened (backend + frontend). Close either to stop that service.
echo.
pause
