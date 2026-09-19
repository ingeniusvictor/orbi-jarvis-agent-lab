@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Configurar OpenAI API
echo ==========================================
echo.
echo La clave se cifrara con Windows DPAPI.
echo No se mostrara en pantalla ni se guardara
echo en texto plano.
echo.

node scripts\configure-openai-key.mjs

echo.
pause
