@echo off
setlocal
title L.U.M.I.A. - ASUS VI-04.1 AUDITORIA VISUAL LOCAL 2B
cd /d "%~dp0"

rem Opt-in diagnostics only. Does not modify the Qwen prompt/answer,
rem change the model, open extra cameras or save any webcam frame.
rem Requires owner to activate Vision and Detectar rostros CPU manually.
set "VITE_LUMIA_VISION_QA_VI041=1"

echo ============================================================
echo  LUMIA VI-04.1 - AUDITORIA LOCAL DE VISUALIZACION
echo  Qwen3.5 2B / fotograma NUEVO por pregunta autorizada
echo  Cruce descriptivo con detector de ROSTROS CPU opcional
echo  Solo metadatos en Chrome DevTools: [lumia:vision-vi041]
echo  NO identifica personas. ROSTROS no son PERSONAS totales.
echo  La camara requiere consentimiento y cierra a los 3 minutos.
echo  Primera ejecucion puede instalar modelo publico BlazeFace.
echo ============================================================
call "%~dp0INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd"
exit /b %ERRORLEVEL%
