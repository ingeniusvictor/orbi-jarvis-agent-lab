@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Configurar cerebro
echo ==========================================
echo.

node scripts\configure-brain-mode.mjs

echo.
pause
