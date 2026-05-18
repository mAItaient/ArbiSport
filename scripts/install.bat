@echo off
REM Script d'installation ArbiSport — Windows

echo === Installation d'ArbiSport ===
echo.

REM ── Vérification Node.js ─────────────────────────────────────────────────
echo ^→ Vérification de Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo ERREUR: Node.js n'est pas installe.
  echo Installez Node.js v20+ depuis https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node --version') do (
  set NODE_MAJOR=%%a
  set NODE_MAJOR=!NODE_MAJOR:v=!
)

echo ✓ Node.js detecte

REM ── Chemin racine ─────────────────────────────────────────────────────────
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

REM ── Installation des dépendances ─────────────────────────────────────────
echo.
echo ^→ Installation des dependances racine...
cd /d "%ROOT_DIR%"
npm install

echo.
echo ^→ Installation des dependances backend...
cd /d "%ROOT_DIR%\backend"
npm install

echo.
echo ^→ Installation des dependances frontend...
cd /d "%ROOT_DIR%\frontend"
npm install

REM ── Fichier d'environnement ──────────────────────────────────────────────
echo.
cd /d "%ROOT_DIR%"
if not exist ".env" (
  echo ^→ Creation du fichier .env...
  copy .env.example .env
  echo ✓ Fichier .env cree.
) else (
  echo ✓ Fichier .env deja present.
)

REM ── Répertoire de données ─────────────────────────────────────────────────
echo.
echo ^→ Creation du repertoire de donnees...
if not exist "data" mkdir data
echo ✓ Repertoire data\ pret.

REM ── Résumé ───────────────────────────────────────────────────────────────
echo.
echo === Installation terminee ! ===
echo.
echo Pour demarrer l'application :
echo   npm run dev
echo.
echo Puis ouvrez http://localhost:5173 dans votre navigateur.
pause
