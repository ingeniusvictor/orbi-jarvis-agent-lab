@echo off
setlocal
title L.U.M.I.A. - ASUS VISION CONTEXTUAL AMR-02.5
cd /d "%~dp0"

rem Opt-in only: existing 2B, Vision4096 and AUTO launchers remain unchanged.
rem No Ollama model, GPU partition, audio engine, camera permission or VRM change.
set "VITE_LUMIA_VISION_CONTEXT_AMR025=1"

echo.
echo ============================================================
echo  LUMIA AMR-02.5 - VISION CONTEXTUAL CON CONSENTIMIENTO
echo  Aclaracion de referencias / recaptura manual 1024 px
echo  AUTO 512/768/1024 / Qwen3.5-4B-Vision4096
echo  Revertir: INICIAR_LUMIA_ASUS_VISION_AUTO.cmd
echo ============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_VISION_AUTO.cmd"
exit /b %ERRORLEVEL%
