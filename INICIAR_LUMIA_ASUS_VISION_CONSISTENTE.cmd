@echo off
setlocal
title L.U.M.I.A. - ASUS AMR-02.6.1 CONSISTENCIA VISUAL
cd /d "%~dp0"

rem AMR-02.6.1: immutable first count and persistent disagreement within
rem the same 5-minute photo session. The previous tracing pilot stays intact.
rem No model replacement, Ollama reset, GPU split or local file writes.
echo.
echo ===============================================================
echo  LUMIA AMR-02.6.1 - CONSISTENCIA VISUAL PERSISTENTE
echo  Diagnostico foto/turno, aviso de discrepancias y OCR
echo  Modelo original Qwen3.5-4B-Vision4096 sin modificaciones
echo ===============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_VISION_TRAZA.cmd"
exit /b %ERRORLEVEL%
