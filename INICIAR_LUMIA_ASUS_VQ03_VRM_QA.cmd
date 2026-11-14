@echo off
setlocal
title L.U.M.I.A. - VQ-03 VRM/VRAM QA - 2B BASAL
cd /d "%~dp0"

rem VQ-03 is code-only. Do not use this in LUMIA-ASUS production.
rem Clone this branch in a distinct directory, then opt-in copy 18
rem gitignored private VRM/R8 assets from the original ASUS installation.
rem Failed preflight must prevent the old GLB fallback.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  exit /b 1
)
node "%~dp0scripts\lumia-private-avatar-assets-vq03.mjs" --require
if errorlevel 1 (
  echo ERROR: Faltan VRM o clips Motion R8 en este laboratorio.
  echo El arranque se ha bloqueado para evitar mostrar el GLB antiguo.
  echo Para preparar una copia privada ver docs\lumia-convergence\42-VQ03-ASUS-ISOLATED-QA-20261113.md
  exit /b 3
)

echo.
echo ===============================================================
echo  LUMIA VQ-03 - PRUEBA TECNICA VRM frente a VRAM
echo  Avatar VRM + 17 FBX verificados en el laboratorio
echo  Motor diario Qwen3.5 2B, mismos flags AMR-03.0 y PH-04
echo  Primero probar por TEXTO. STT/TTS requieren runtime local
echo  separado; NO declarar voz lista sin comprobar Whisper/Kokoro.
echo  Sin camara automatica, biometria ni escrituras al PC.
echo ===============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd"
exit /b %ERRORLEVEL%
