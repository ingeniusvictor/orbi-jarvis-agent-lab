@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Brain Doctor
echo ==========================================
echo.

call npm.cmd run brain:doctor

echo.
pause
