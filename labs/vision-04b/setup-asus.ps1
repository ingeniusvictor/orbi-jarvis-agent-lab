# LUMIA VI-04B — isolated DeepFace/SFace CPU lab setup on Windows.
# Does not touch the LUMIA main Python environment, Qwen, Whisper or Kokoro.
[CmdletBinding()]
param(
    [switch]$SkipPipUpgrade
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoUrl = 'https://github.com/ingeniusvictor/deepface.git'
$pinnedSha = 'a8cee7b3949d6d9fbba53c82eeca6956e233d623'
$lab = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-FACE-LAB-VI04B'
$clone = Join-Path $lab 'deepface-fork'
$venv = Join-Path $lab '.venv'
$python = Join-Path $venv 'Scripts\python.exe'
New-Item -ItemType Directory -Force -Path $lab | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git no está disponible.'
}
if (-not (Test-Path $clone)) {
    Write-Host 'Clonando DeepFace en laboratorio aislado (no modifica tu fork remoto)...'
    git clone $repoUrl $clone
    if ($LASTEXITCODE -ne 0) { throw 'Falló la descarga del fork.' }
}
if (-not (Test-Path (Join-Path $clone '.git'))) {
    throw 'La carpeta del fork local existe pero no es un repositorio Git.'
}
$origin = git -C $clone remote get-url origin
if ($LASTEXITCODE -ne 0 -or $origin -ne $repoUrl) {
    throw 'El repositorio local no corresponde al fork esperado; no se modificará.'
}
$dirty = git -C $clone status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) {
    throw 'La copia local del laboratorio contiene cambios; no se sobrescribirán.'
}
$current = git -C $clone rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el commit del fork.' }
if ($current -ne $pinnedSha) {
    git -C $clone fetch origin $pinnedSha
    if ($LASTEXITCODE -ne 0) { throw 'No se encontró el commit fijado.' }
    git -C $clone checkout --detach $pinnedSha
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo fijar el fork al commit revisado.' }
}
if (-not (Test-Path $python)) {
    Write-Host 'Creando Python aislado. Se recomienda Python 3.11 o 3.12 de 64 bits.'
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3.11 -m venv $venv
        if ($LASTEXITCODE -ne 0) { py -3.12 -m venv $venv }
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        python -m venv $venv
    } else {
        throw 'Instala Python 3.11 o 3.12 antes de crear el laboratorio.'
    }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $python)) {
        throw 'No se pudo crear el entorno Python aislado.'
    }
}
if (-not $SkipPipUpgrade) {
    & $python -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw 'Error preparando pip.' }
}
Write-Host 'Instalando SOLO DeepFace ONNX y dependencias base en el entorno aislado...'
& $python -m pip install --prefer-binary $clone
if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación de DeepFace.' }
$env:DEEPFACE_BACKEND_ENGINE = 'onnx'
$env:DEEPFACE_ONNX_PROVIDERS = 'cpu'
$env:CUDA_VISIBLE_DEVICES = '-1'
& $python (Join-Path $PSScriptRoot 'verify_pair.py') --doctor
if ($LASTEXITCODE -ne 0) { throw 'El laboratorio no pasó su revisión de instalación.' }
Write-Host 'LAB VISION-04B instalado. Para probar dos fotografías consentidas:'
Write-Host ('& "' + $python + '" "' + (Join-Path $PSScriptRoot 'verify_pair.py') + '" --image-a "C:\FOTOS\foto1.jpg" --image-b "C:\FOTOS\foto2.jpg"')
Write-Host 'No habilita identificación en vivo ni cambia los cerebros de LUMIA.'
