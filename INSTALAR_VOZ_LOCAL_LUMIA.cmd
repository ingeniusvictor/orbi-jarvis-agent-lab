@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   L.U.M.I.A. - Instalador de voz local
echo ==========================================
echo.
echo Este proceso instalara Kokoro y su voz local
echo dentro de .local-runtime sin modificar Windows.
echo.
echo Puede tardar varios minutos la primera vez.
echo.

call npm.cmd run voice:setup:kokoro
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo completar la instalacion de Kokoro.
  echo Revisa el mensaje anterior para identificar el componente faltante.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   Verificando runtime de voz
echo ==========================================
echo.
call npm.cmd run voice:doctor
if errorlevel 1 (
  echo.
  echo [ADVERTENCIA] La instalacion termino, pero Voice Doctor detecto un problema.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   Voz local de L.U.M.I.A. preparada
echo ==========================================
echo.
echo Cierra L.U.M.I.A. y vuelve a abrirla para
echo activar Whisper + Kokoro local.
echo.
pause
