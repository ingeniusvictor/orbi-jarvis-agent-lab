@echo off
setlocal
title L.U.M.I.A. - ASUS VISION AMR-02.6 TRAZABILIDAD Y COHERENCIA
cd /d "%~dp0"

rem Pilot only. No model, VRAM, Whisper, Kokoro, VRM or camera permission changes.
rem 02.6: private image/turn ID for metrics; socket-only count consistency
rem (no second model call, image cache, file writes or camera reactivation).
set "VITE_LUMIA_VISION_TRACE_AMR026=1"
set "ORBIA_LUMIA_VISUAL_QA_AMR026=1"

echo.
echo ==============================================================
echo  LUMIA AMR-02.6 - VISION CON TRAZA Y CONSISTENCIA
echo  Qwen3.5-4B-Vision4096 / AUTO / consentimiento AMR-02.5
echo  Rollback: INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd
echo ==============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd"
exit /b %ERRORLEVEL%
