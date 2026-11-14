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
rem PH-04 VRM/FBX are gitignored private local assets; a fresh git worktree
rem does not inherit them. Fail CLOSED rather than silently render legacy GLB.
node "%~dp0scripts\lumia-private-avatar-assets.mjs" --require
if errorlevel 1 (
  echo.
  echo ERROR: Faltan archivos privados VRM o Motion R8 en este laboratorio.
  echo No se iniciara la version antigua GLB como si fuera VI-04.1.
  echo Consulta el protocolo VI-04.1 para copiar recursos locales sin sobrescribir.
  pause
  exit /b 3
)
call "%~dp0INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd"
exit /b %ERRORLEVEL%
