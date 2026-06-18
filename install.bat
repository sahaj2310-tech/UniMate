@echo off
REM ============================================================
REM  UniMate - Dependency Installer
REM  Installs ALL frontend and backend requirements / modules.
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================
echo    UniMate - Installing dependencies
echo ============================================
echo.

REM ---- Check Node.js ----
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js not found. Install it from https://nodejs.org/ ^(v20+^).
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo   OK Node.js %%i

REM ---- Check Python ----
echo [2/5] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Python not found. Install it from https://www.python.org/ ^(3.11+^).
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo   OK %%i

REM ---- Frontend dependencies ----
echo.
echo [3/5] Installing frontend dependencies ^(npm^)...
call npm install
if errorlevel 1 (
    echo   ERROR: npm install failed.
    pause
    exit /b 1
)
echo   OK Frontend dependencies installed.

REM ---- Backend virtual environment ----
echo.
echo [4/5] Creating Python virtual environment...
if not exist "backend\.venv" (
    python -m venv backend\.venv
    if errorlevel 1 (
        echo   ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
)
echo   OK Virtual environment ready at backend\.venv

REM ---- Backend dependencies ----
echo.
echo [5/5] Installing backend dependencies ^(pip^)...
call backend\.venv\Scripts\python.exe -m pip install --upgrade pip >nul
call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo   ERROR: pip install failed.
    pause
    exit /b 1
)
echo   OK Backend dependencies installed.

REM ---- Environment file ----
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo   Created .env from .env.example
)

echo.
echo ============================================
echo    Setup complete!  Run start.bat to launch.
echo ============================================
echo.
pause
