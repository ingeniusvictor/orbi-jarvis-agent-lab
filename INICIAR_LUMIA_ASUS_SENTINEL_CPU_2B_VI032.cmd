@echo off
setlocal
title L.U.M.I.A. - ASUS VI-03.2 SENTINEL CPU - QWEN 2B
cd /d "%~dp0"

rem Optional local CPU-only optical changes. A camera is NEVER opened
rem by environment flags: the owner must open the viewer and click Activar vision.
rem 2B remains native from AMR-03.0 launcher. The existing 4B choice
rem remains manual in CEREBRO LOCAL, never switched by motion.
set "VITE_LUMIA_VISION_SENTINEL_VI032=1"
echo ============================================================
echo  LUMIA VI-03.2A - SENTINEL CPU / 2B NATIVO
echo  Cambios visuales en CPU a 96x54 / cada 750 ms
echo  Sin consultas automaticas, TTS espontaneo, ni modelo extra
echo  4B: solo seleccion manual de usuario para detalle visual
echo  Sesion limitada de Vision Activa: 3 minutos
echo ============================================================
call "%~dp0INICIAR_LUMIA_ASUS_VISION_ACTIVA_VI031.cmd"
exit /b %ERRORLEVEL%
