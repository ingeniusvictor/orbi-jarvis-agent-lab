@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   L.U.M.I.A. - Instalar diarizacion local
echo ==========================================
echo.
call npm run voice:setup:diarization
if errorlevel 1 goto :done
echo.
call npm run voice:gate:doctor
:done
echo.
pause
