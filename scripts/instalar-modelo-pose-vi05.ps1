# VI-05A — installer of ONE pinned official MediaPipe Pose Lite bundle.
# Run only from C:\Users\<user>\LUMIA-NEXT-QA (not the protected daily ASUS).
# Offline operation afterward; no installation into global Python/Windows.
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedRoot = Join-Path $env:USERPROFILE "LUMIA-NEXT-QA"
if ([IO.Path]::GetFullPath($root).TrimEnd('\') -ine
    [IO.Path]::GetFullPath($expectedRoot).TrimEnd('\')) {
    throw "VI-05A solo instala el modelo en LUMIA-NEXT-QA."
}
$branch = (& git -C $root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne "integration/lumia-asus-next-20261114") {
    throw "Rama NEXT inesperada. Instalacion cancelada."
}
$uri = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
$expectedHash = "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
$expectedBytes = 5777746
$folder = Join-Path $root "public\models\vision"
$target = Join-Path $folder "pose_landmarker_lite.task"
New-Item -ItemType Directory -Path $folder -Force | Out-Null

function Test-PoseModel([string]$file) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { return $false }
    if ((Get-Item -LiteralPath $file).Length -ne $expectedBytes) { return $false }
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    return $hash -eq $expectedHash
}

if (Test-Path -LiteralPath $target) {
    if (!(Test-PoseModel $target)) {
        throw "Ya existe un modelo distinto. No se sobreescribira automaticamente."
    }
    Write-Host "[OK] Pose Landmarker Lite ya esta verificado y disponible offline." -ForegroundColor Green
    exit 0
}

$partial = "$target.partial-$PID"
try {
    Write-Host "Descargando modelo oficial MediaPipe Pose Lite a NEXT..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $uri -OutFile $partial -UseBasicParsing -TimeoutSec 120
    if (!(Test-PoseModel $partial)) {
        throw "Hash SHA-256 o tamano inesperado. Descarga descartada."
    }
    Move-Item -LiteralPath $partial -Destination $target -ErrorAction Stop
    Write-Host "[OK] Modelo SHA-256 correcto. Preparado para funcionar sin internet." -ForegroundColor Green
    Write-Host $target
}
finally {
    if (Test-Path -LiteralPath $partial) {
        Remove-Item -LiteralPath $partial -Force
    }
}
