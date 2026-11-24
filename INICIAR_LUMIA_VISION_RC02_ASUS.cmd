@echo off
setlocal
title L.U.M.I.A. - RC02 POSTURA CPU / ESCRITORIO ASUS
cd /d "%~dp0"
rem This wrapper operates ONLY in the isolated RC02 QA checkout.
if /I "%CD%"=="%USERPROFILE%\LUMIA-ASUS" (
 echo ERROR: original ASUS protected. RC02 is QA only.
 exit /b 4
)
if /I not "%CD%"=="%USERPROFILE%\LUMIA-RC01-QA" (
 echo ERROR: RC02 only launches from LUMIA-RC01-QA.
 exit /b 4
)
rem No silent model downloads, no globally changed environment, no second camera.
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-modelo-pose-rc02.ps1" -VerifyOnly
if errorlevel 1 (
 echo ERROR: falta el modelo Pose Lite RC02 verificado.
 echo Ejecuta: powershell -ExecutionPolicy Bypass -File ".\scripts\instalar-modelo-pose-rc02.ps1"
 exit /b 3
)
rem UI consent is still required: Activar vision, then Activar postura CPU.
set "VITE_LUMIA_VISION_POSE_VI05A=1"
echo ==============================================================
echo LUMIA RC02 - VISION RC01 + CENTINELA CORPORAL VI-05A.1
echo Perfil Escritorio sentado - Qwen 3.5 2B, Pose Lite CPU
echo Sin ver manos abajo: indeterminado / fuera de encuadre
echo Webcam, MediaPipe y Qwen no se activan sin la autorizacion de usuario
echo ==============================================================
call "%~dp0INICIAR_LUMIA_VISION_RC01_ASUS.cmd"
exit /b %ERRORLEVEL%
