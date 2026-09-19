@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Voice Doctor
echo ==========================================
echo.

call npm.cmd run voice:doctor

echo.
pause
