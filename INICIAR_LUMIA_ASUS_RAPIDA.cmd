@echo off
setlocal
title L.U.M.I.A. - ASUS LOCAL RAPIDA (PRUEBA)
cd /d "%~dp0"

rem ASUS pilot only. All switches are local to this window.
rem No paid realtime, no remote access, no write-capable tools.
set "ORBIA_BRAIN_PROVIDER=ollama"
set "ORBIA_BRAIN_DEFAULT=ollama"
set "JARVIS_PROVIDER=ollama"
set "ORBIA_LUMIA_MODEL=qwen3.5:2b-q4_K_M"
set "JARVIS_OLLAMA_MODEL=qwen3.5:2b-q4_K_M"
set "ORBIA_LUMIA_STT_MODE=local"
set "ORBIA_LUMIA_TTS_MODE=local"
set "ORBIA_LUMIA_VOICE_PROFILE=lumia-kokoro"
set "VITE_BACKEND=bridge"
set "ORBIA_WHISPER_SERVER_ENABLED=1"
set "ORBIA_KOKORO_RESIDENT_ENABLED=1"
set "VITE_LUMIA_TTS_PREFETCH_NEXT=1"
rem Optical face-only horizontal correction in CSS pixels; default canon remains +25.
set "VITE_LUMIA_FACE_SHIFT_PX=0"
set "VITE_LUMIA_VISUAL_INPUT_VI01=1"
set "ORBIA_LUMIA_VISION_ENABLED=1"
set "JARVIS_ALLOW_WRITES=0"
set "ORBIA_REALTIME_EXPERIMENT=0"
set "VITE_LUMIA_REALTIME_EXPERIMENT=0"
set "VITE_USE_ELEVENLABS=false"
rem Keep unrelated voice experiments OFF to isolate improvements.
set "VITE_LUMIA_ADAPTIVE_TURNS=0"
set "VITE_LUMIA_FAST_LOCAL_FOLLOWUP=0"
set "VITE_LUMIA_STREAMING_TTS=0"

echo.
echo ============================================================
echo   L.U.M.I.A. / ASUS - local voice low-latency PILOT
echo   Whisper resident + Kokoro resident + phrase prefetch
echo   Qwen3.5 2B; face horizontal calibration = 0 CSS px
echo   Realtime API OFF / writes OFF
echo ============================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found on PATH.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo ERROR: npm dependencies missing. Run: npm.cmd ci
  pause
  exit /b 1
)
echo Open the URL printed by Vite in a real Chrome/Edge window.
echo Do not launch a second LUMIA bridge on the same port.
echo Press CTRL+C to close. For previous voice behavior, use the manual launcher.
echo.
call npm.cmd run start:lumia
set "code=%ERRORLEVEL%"
echo.
echo LUMIA has stopped. Exit code: %code%
pause
exit /b %code%
