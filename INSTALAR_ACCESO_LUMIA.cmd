@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   Instalando acceso directo de L.U.M.I.A.
echo ==========================================
echo.
node scripts\install-lumia-desktop.mjs
echo.
pause
