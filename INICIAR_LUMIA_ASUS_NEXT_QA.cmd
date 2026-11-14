@echo off
setlocal
title L.U.M.I.A. NEXT - 2B + VISION-04.1 + AVATAR VQ-05.1
cd /d "%~dp0"

rem Canonical integrated QA launcher. NEVER used by the protected ASUS
rem daily installation. All flags are inherited by the vision pilot chain.
rem Only the owner can activate camera and CPU face presence in the UI.
where node >nul 2>&1
if errorlevel 1 (
 echo ERROR: falta Node.js.
 exit /b 1
)

rem Avoid legacy GLB fallback. 1 private VRM + 17 FBX required locally.
node "%~dp0scripts\lumia-private-avatar-assets-vq03.mjs" --require
if errorlevel 1 (
 echo ERROR: faltan assets VRM/R8; no se inicia NEXT.
 exit /b 3
)

rem From the user-approved VQ-04 and VQ-05.1 visual QA.
set "ORBIA_LUMIA_VRM_GROUNDING_VQ03=1"
set "VITE_LUMIA_AVATAR_QA_VQ03=1"
set "VITE_LUMIA_NATURAL_FACE_VQ04=1"
set "VITE_LUMIA_SPEECH_EXPRESSIONS_VQ05=1"
set "VITE_LUMIA_FACE_DIRECT_VQ051=1"
rem VI-04.2A pilot: exact-JPEG CPU QA on explicitly authorized visual questions.
rem No extra camera access, no identity, no automatic LLM retakes.
set "VITE_LUMIA_VISION_SAME_FRAME_VI042A=1"

echo.
echo ===============================================================
echo LUMIA NEXT QA - UNA SOLA VERSION ACUMULATIVA
echo Avatar VQ-04/VQ-05.1 aprobado visualmente en ASUS.
echo Vision VI-04.1 verificada en ASUS; VI-04.2A mismo JPEG EN PRUEBA.
echo Qwen3.5 2B + Whisper y Kokoro locales (segun wrapper).
echo Rostros CPU no son identidad ni conteo total de personas.
echo Camara OFF hasta autorizacion desde la interfaz.
echo No cambiar RAM, energia, hilos ONNX o instalacion ASUS.
echo ===============================================================
echo.
rem VI-04.2A (opt-in) -> VI-04.1 -> VI-04A -> VI-03.2B -> sentinel -> AMR-03.0 -> daily.
rem No second app server, no second camera stream, no extra LLM brain.
call "%~dp0INICIAR_LUMIA_ASUS_VISION_AUDITORIA_VI041.cmd"
exit /b %ERRORLEVEL%
