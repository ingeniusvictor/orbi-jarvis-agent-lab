@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Eliminar OpenAI API
echo ==========================================
echo.

node scripts\configure-openai-key.mjs --remove

echo.
pause
