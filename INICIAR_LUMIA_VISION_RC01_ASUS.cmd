@echo off
setlocal
title L.U.M.I.A. - VISION VI-04.2B.3 RC01 ASUS QA
cd /d "%~dp0"
rem ONLY for a separate candidate checkout, NOT the protected original.
if /I "%CD%"=="%USERPROFILE%\LUMIA-ASUS" (
  echo ERROR: RC01 must not run from the protected LUMIA-ASUS original.
  exit /b 4
)
rem These flags only affect the process spawned in this terminal.
rem Existing original 2B local/Whisper/Kokoro/VRM stay unchanged.
set "VITE_LUMIA_VISION_QA_VI041=1"
set "VITE_LUMIA_VISION_FACES_VI04A=1"
set "VITE_LUMIA_VISION_SAME_FRAME_VI042A=1"
set "VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B=1"
echo ===========================================================
echo LUMIA RC01 - Same JPEG / CPU face count / arms and torso
echo ASUS Qwen 3.5 2B - same original voice and avatar
echo Camera OFF until user authorization; no identity tracking
echo This is a QA candidate, NOT an installed production update.
echo ===========================================================
call "%~dp0INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd"
exit /b %ERRORLEVEL%
