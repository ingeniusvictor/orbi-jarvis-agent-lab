@echo off
setlocal
title L.U.M.I.A. - ASUS VI-03.0 OJOS TEMPORALES
cd /d "%~dp0"

rem Owner opt-in only. Inherit the stable 2B, Kokoro and webcam permissions
rem from AMR-03.0. Does NOT launch the AMR-03.1 timing experiment.
set "VITE_LUMIA_VISION_TEMPORAL_VI030=1"
echo.
echo ===========================================================
echo  LUMIA VI-03.0 - OJOS TEMPORALES / VERACIDAD VISUAL
echo  Qwen3.5 2B - webcam solo con autorizacion
echo  No confundira una foto anterior con vision en directo
echo  Sin video continuo, nuevas capturas ni procesos extras
echo ===========================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd"
exit /b %ERRORLEVEL%
