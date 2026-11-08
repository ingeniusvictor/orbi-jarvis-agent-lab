@echo off
setlocal
title L.U.M.I.A. - ASUS 4B VISION4096 (PILOTO)
cd /d "%~dp0"

rem AMR-02.2: opt-in unified 4B vision pilot; leave the regular 2B launcher intact.
rem Does not download/delete/modify Ollama models or permanently set env values.
where ollama >nul 2>&1
if errorlevel 1 (
  echo ERROR: Ollama no esta disponible en PATH.
  pause
  exit /b 1
)
ollama show qwen3.5:4b-vision4096 >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro qwen3.5:4b-vision4096 en Ollama.
  echo Crear y verificar el perfil local primero. No se descargara nada.
  pause
  exit /b 1
)

rem The model's Modelfile owns num_gpu=32, num_batch=128, num_ctx=4096.
rem The bridge must not override layer distribution or batch at runtime.
set "LUMIA_ASUS_MODEL_OVERRIDE=qwen3.5:4b-vision4096"
set "JARVIS_OLLAMA_KEEP_ALIVE=30m"

echo.
echo ============================================================
echo   L.U.M.I.A. - PILOTO UNIFICADO QWEN3.5 4B VISION 4096
echo   4096 contexto / 32 capas GPU / 128 batch (Modelfile)
echo   Whisper + Kokoro + Avatar + Vision, sin cambios
echo   2B baseline: INICIAR_LUMIA_ASUS_RAPIDA.cmd
echo ============================================================
echo.
echo NOTA: Ollama es un proceso independiente. Este script no altera
echo OLLAMA_MAX_LOADED_MODELS, OLLAMA_NUM_PARALLEL ni el driver.
echo Si dos modelos compiten por VRAM, use ollama ps y descargue
echo el modelo anterior manualmente con ollama stop.
echo.
call "%~dp0INICIAR_LUMIA_ASUS_RAPIDA.cmd"
exit /b %ERRORLEVEL%
