@echo off
setlocal
title L.U.M.I.A. - ASUS 4B VISION ADAPTATIVA (AMR-02.4)
cd /d "%~dp0"

rem Opt-in only. Default AMR-02.3/02.2 launchers are unchanged.
rem This flag enables the explicit AUTO image resolution selector.
rem All vision remains local and requires the same owner authorization.
set "VITE_LUMIA_VISION_AUTO_AMR024=1"
echo.
echo ============================================================
echo  LUMIA AMR-02.4 · ASUS Qwen3.5-4B-Vision4096
echo  Vision AUTO conservadora: 512 / 768 / 1024
echo  Selector manual disponible · rollback: Vision4096 launcher
echo ============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_VISION4096.cmd"
exit /b %ERRORLEVEL%
