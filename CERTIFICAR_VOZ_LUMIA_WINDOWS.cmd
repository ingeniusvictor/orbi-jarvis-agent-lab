@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 (
  echo No se pudo acceder al directorio del proyecto LUMIA.
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encuentra Node.js. Instala Node 22 o superior.
  popd
  exit /b 1
)
echo.
echo ====================================================
echo  LUMIA VL-06  -  CERTIFICACION PREVIA WINDOWS
echo ====================================================
echo Este chequeo no usa el microfono, claves ni servicios de pago.
echo.
node scripts\lumia-voice-preflight.mjs --live
set "CHECK_EXIT=%ERRORLEVEL%"
echo.
if "%CHECK_EXIT%"=="0" (
  echo Resultado: LISTO PARA PRUEBAS MANUALES DE VOZ.
  echo No significa que el sonido o la latencia esten certificados.
) else (
  echo Resultado: REQUIERE REVISION.
  echo Si el bridge esta apagado, inicia npm run start:lumia
  echo en otra terminal y vuelve a ejecutar este archivo.
)
echo.
popd
exit /b %CHECK_EXIT%
