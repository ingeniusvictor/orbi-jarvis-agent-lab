@echo off
setlocal
title L.U.M.I.A. - ASUS VI-03.2B VISION REAL POR VOZ - 2B
cd /d "%~dp0"
rem Opt-in only. Does not open the webcam, download models, or change GPU.
rem Inherits VI-03.2A optical Sentinel, VI-03.1 camera, stable AMR-03.0 2B.
set "VITE_LUMIA_VISION_FRESH_VOICE_VI032B=1"
echo ==============================================================
echo  LUMIA VI-03.2B - VER OTRA VEZ SIN FOTOGRAMAS ANTIGUOS
echo  Qwen3.5 2B nativo, 4B solo manual para detalle excepcional
echo  Para ver: abrir LUMIA VISION y pulsar Activar vision
echo  La camara se cierra a los 3 minutos: reactivacion manual
echo  Preguntas visuales: fotograma NUEVO en el momento de preguntar
echo  Indicador QA: console [lumia:vision-vi032b]
echo ==============================================================
call "%~dp0INICIAR_LUMIA_ASUS_SENTINEL_CPU_2B_VI032.cmd"
exit /b %ERRORLEVEL%
