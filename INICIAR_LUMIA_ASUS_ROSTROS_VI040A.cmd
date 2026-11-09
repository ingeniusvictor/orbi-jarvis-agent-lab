@echo off
setlocal
title L.U.M.I.A. - ASUS VI-04A ROSTROS CPU + QWEN 2B
cd /d "%~dp0"

rem Pilot must be started explicitly. The actual webcam needs its existing
rem consent AND the user must choose Activar vision + Detectar rostros CPU.
rem This downloads only a public facial DETECTOR once; no camera images.
set "VITE_LUMIA_VISION_FACES_VI04A=1"
echo ============================================================
echo  LUMIA VISION-04A - DETECTOR REAL DE ROSTROS (SOLO CPU)
echo  Qwen3.5 2B NATIVO; 4B no se activa automaticamente
echo  Primer inicio: prepara modelo BlazeFace oficial local
echo  No reconoce nombres ni guarda fotografias o datos faciales
echo  Sesiones activas: maximo 3 minutos, detener al cerrar
echo ============================================================

node "%~dp0scripts\install-lumia-face-model-vi04.mjs"
if errorlevel 1 (
  echo [AVISO] No se instalo BlazeFace. LUMIA iniciara normalmente.
  echo [AVISO] La deteccion facial indicara error hasta instalar el modelo.
)
call "%~dp0INICIAR_LUMIA_ASUS_VISION_REVISAR_VI032B.cmd"
exit /b %ERRORLEVEL%
