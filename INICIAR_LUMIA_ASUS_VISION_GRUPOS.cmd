@echo off
setlocal
title L.U.M.I.A. - ASUS AMR-02.7 VISION GRUPAL Y CACHE
cd /d "%~dp0"

rem Optional group/count resolution pilot. Existing 02.6.1 and all lower
rem launchers stay unchanged; only opt in through this dedicated .cmd.
rem 1024px for explicit people-group questions on NEW images only.
rem For already-captured 768px images: require owner approval to reanalyze.
rem Cache metrics are logged only when Ollama actually returns the field.
set "VITE_LUMIA_VISION_ADAPTIVE_AMR027=1"
set "ORBIA_LUMIA_VISUAL_CACHE_AMR027=1"

echo.
echo ===============================================================
echo  LUMIA AMR-02.7 - AUTO GRUPOS 1024 Y METRICAS CACHE
echo  Seguimientos a 768px: elevar calidad solo con permiso
echo  Sin cambios de Ollama, GPU, Whisper, Kokoro ni avatar VRM
echo ===============================================================
echo.
call "%~dp0INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd"
exit /b %ERRORLEVEL%
