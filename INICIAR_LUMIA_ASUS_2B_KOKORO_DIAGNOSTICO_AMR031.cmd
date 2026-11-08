@echo off
setlocal
title L.U.M.I.A. - ASUS AMR-03.1 KOKORO TIMING
cd /d "%~dp0"
rem AMR-03.1 is diagnostic-only: the existing AMR-03.0 sound pipeline remains unchanged.
rem Logs are visible in Chrome DevTools Console, prefixed [lumia][AMR-03.1][Kokoro].
rem No text, WAV contents, external service or additional model inference is logged.
set "VITE_LUMIA_KOKORO_TIMING_AMR031=1"
echo ===========================================================
echo  LUMIA AMR-03.1 - KOKORO / WAV TIMING (ASUS 2B)
echo  Sin cambios de voz, modelo, segmentacion o concurrencia
echo  Abra Chrome DevTools ^> Console para medir cada fragmento
echo  Comparacion A/B: lanzador AMR-03.0 previo
echo ===========================================================
call "%~dp0INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd"
exit /b %ERRORLEVEL%
