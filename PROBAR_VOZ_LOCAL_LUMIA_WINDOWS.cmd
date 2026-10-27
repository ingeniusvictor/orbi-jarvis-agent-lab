@echo off
setlocal EnableExtensions
pushd "%~dp0"
if errorlevel 1 (
  echo ERROR: no fue posible acceder al directorio de LUMIA.
  exit /b 1
)
echo.
echo ================================================================
echo   LUMIA VL-06  -  PRUEBA DE VOZ LOCAL EN WINDOWS SIN API DE PAGO
echo ================================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta disponible. Instala Node 22 o superior.
  popd
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo ERROR: faltan las dependencias del proyecto.
  echo En esta carpeta ejecuta primero: npm ci
  popd
  exit /b 1
)

rem Temporary, process-only overrides. Never edit .env.local, change Git
rem branches, persist secrets, enable write permissions or request API access.
rem The local Ollama/Kokoro/Whisper runtime may still need to be installed.
set "ORBIA_BRAIN_PROVIDER=ollama"
set "JARVIS_PROVIDER=ollama"
set "ORBIA_BRAIN_DEFAULT=ollama"
set "JARVIS_ALLOW_WRITES=0"
set "ORBIA_REALTIME_EXPERIMENT=0"
set "VITE_LUMIA_REALTIME_EXPERIMENT=0"
set "VITE_LUMIA_STREAMING_TTS=0"
set "VITE_LUMIA_ADAPTIVE_TURNS=0"
set "VITE_LUMIA_FAST_LOCAL_FOLLOWUP=0"
set "VITE_USE_ELEVENLABS=0"
set "ORBIA_LUMIA_STT_MODE=local"
set "ORBIA_LUMIA_TTS_MODE=local"
set "VITE_LUMIA_ACOUSTIC_LAB=1"

echo MODO SEGURO: Ollama local + STT/TTS local cuando esten disponibles.
echo Realtime y uso de API de voz: DESACTIVADOS.
echo Herramientas de escritura: DESACTIVADAS.
echo El laboratorio acustico se muestra solo en este arranque.
echo.
echo Cuando Vite muestre su URL local:
echo  1. Abre esa URL en Chrome o Edge.
echo  2. Enciende LUMIA y pulsa "LUMIA - LAB ACUSTICO".
echo  3. Comprueba microfono, tono y recuperacion del modo normal.
echo  4. En otra terminal puedes ejecutar:
echo       node scripts\lumia-voice-preflight.mjs --live
echo.
echo Ctrl+C cierra la prueba. No se cambia la configuracion permanente.
echo.
call npm run start:lumia
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
