@echo off
setlocal
title L.U.M.I.A. - ASUS VI-03.1 VISION ACTIVA
cd /d "%~dp0"
rem Owner opt-in feature; the actual camera session must still be activated
rem by pressing the explicit VISION ACTIVA button inside the authorized viewer.
rem Stable AMR-03.0 Qwen3.5 2B and Kokoro; no AMR-03.1 voice timing.
set "VITE_LUMIA_VISION_TEMPORAL_VI030=1"
set "VITE_LUMIA_VISION_ACTIVE_VI031=1"
echo ===========================================================
echo  LUMIA VI-03.1 - VISION ACTIVA AUTORIZADA
echo  Actualizacion visual cada 12s, maximo 3 minutos por sesion
echo  Imagen local en memoria; Ollama solo bajo pregunta/autorizacion
echo  No cambia cerebro, Kokoro ni configuracion GPU
echo ===========================================================
call "%~dp0INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd"
exit /b %ERRORLEVEL%
