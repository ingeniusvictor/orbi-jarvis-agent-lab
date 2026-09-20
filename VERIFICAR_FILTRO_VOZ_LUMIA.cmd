@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   L.U.M.I.A. - Verificar Voice Gate
echo ==========================================
echo.
call npm run voice:gate:doctor
echo.
pause
