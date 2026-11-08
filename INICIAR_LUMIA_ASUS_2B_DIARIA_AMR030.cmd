@echo off
setlocal
title L.U.M.I.A. - ASUS AMR-03.0 2B DIARIA Y VOZ CONTINUA
cd /d "%~dp0"

rem Dedicated owner-opt-in pilot. DO NOT call VISION4096/GRUPOS:
rem those intentionally override the brain to Qwen3.5 4B.
rem The old 4B launchers remain available and untouched.
where ollama >nul 2>&1
if errorlevel 1 (
  echo ERROR: Ollama no disponible. Enciende Ollama sin modificar modelos.
  pause
  exit /b 1
)
ollama show qwen3.5:2b-q4_K_M >nul 2>&1
if errorlevel 1 (
  echo ERROR: qwen3.5:2b-q4_K_M no esta instalado.
  echo Comprueba con ollama list. No se descargara nada.
  pause
  exit /b 1
)

rem Session-only defaults. Existing model selector still allows manual switch.
set "LUMIA_ASUS_MODEL_OVERRIDE=qwen3.5:2b-q4_K_M"
set "JARVIS_OLLAMA_KEEP_ALIVE=30m"

rem Preserve existing authorized AUTO vision, context and count checks.
set "VITE_LUMIA_VISION_AUTO_AMR024=1"
set "VITE_LUMIA_VISION_CONTEXT_AMR025=1"
set "VITE_LUMIA_VISION_TRACE_AMR026=1"
set "ORBIA_LUMIA_VISUAL_QA_AMR026=1"
set "ORBIA_LUMIA_VISUAL_CACHE_AMR027=1"

rem Daily default: maintain 768px AUTO for generic images AND group prompts;
rem original AMR-02.7 automatic 1024 group pilot remains a separate launcher.
rem Manual 1024 and authorized recapture remain available.
set "VITE_LUMIA_VISION_ADAPTIVE_AMR027=0"

rem AMR-03.0 protections: no second model call, no automatic camera access.
set "ORBIA_LUMIA_VISUAL_POSTURE_GUARD_AMR030=1"
set "VITE_LUMIA_KOKORO_COMPACT_PHRASES=1"

echo.
echo ===============================================================
echo  LUMIA AMR-03.0 - QWEN3.5 2B DIARIA
echo  Texto y vision rapidos / 4B elegible desde CEREBRO LOCAL
echo  AUTO vision 768 px / 1024 manual con autorizacion
echo  Kokoro frases largas mas compactas + chequeo de conteos
echo  Sin cambiar Ollama, pesos, GPU, Whisper ni voz Kokoro
echo ===============================================================
echo.
echo Para volver al piloto 4B: INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd
echo Para el 2B sin estas mejoras: INICIAR_LUMIA_ASUS_RAPIDA.cmd
echo.
call "%~dp0INICIAR_LUMIA_ASUS_RAPIDA.cmd"
exit /b %ERRORLEVEL%
