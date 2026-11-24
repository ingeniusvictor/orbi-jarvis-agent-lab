# LUMIA VI-05A.1 / RC02 — instalar o verificar Pose Landmarker Lite sin alterar ASUS original.
# Por defecto: reutiliza modelo oficial ya validado en LUMIA-NEXT-QA (LAN/Internet no requeridos).
# Solo -AllowDownload permite descargar si no hay copia local. -VerifyOnly no escribe.
[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [switch]$AllowDownload
)
$ErrorActionPreference = 'Stop'
if ($VerifyOnly -and $AllowDownload) { throw 'VerifyOnly no permite descargas.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$expected = Join-Path $env:USERPROFILE 'LUMIA-RC01-QA'
if ([IO.Path]::GetFullPath($root).TrimEnd('\') -ine
    [IO.Path]::GetFullPath($expected).TrimEnd('\')) {
    throw 'RC02 solo instala el modelo en LUMIA-RC01-QA, no en la original ASUS.'
}
$branch = (& git -C $root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'release-candidate/lumia-vi05a1-asus-20261124') {
    throw 'RC02 no es la rama activa en esta carpeta. Instalacion cancelada.'
}
$expectedHash = '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'
$expectedBytes = 5777746
$folder = Join-Path $root 'public\models\vision'
$target = Join-Path $folder 'pose_landmarker_lite.task'
$source = Join-Path $env:USERPROFILE 'LUMIA-NEXT-QA\public\models\vision\pose_landmarker_lite.task'
$uri = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
function Test-OfficialPose([string]$file) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { return $false }
    if ((Get-Item -LiteralPath $file).Length -ne $expectedBytes) { return $false }
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    return $hash -eq $expectedHash
}
if (Test-Path -LiteralPath $target) {
    if (!(Test-OfficialPose $target)) { throw 'Existe otro archivo Pose Lite: no se sobrescribe.' }
    Write-Host '[LUMIA RC02] Modelo Pose Lite local verificado: 5.777.746 bytes y SHA256 correcto.' -ForegroundColor Green
    exit 0
}
if ($VerifyOnly) { throw 'Falta Pose Lite RC02. Ejecutar instalador sin -VerifyOnly.' }
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$partial = "$target.partial-$PID"
try {
    if (Test-Path -LiteralPath $source) {
        if (!(Test-OfficialPose $source)) { throw 'Modelo NEXT existente no coincide con hash oficial; copia cancelada.' }
        Write-Host 'Reutilizando Pose Lite validado desde NEXT (copia local sin Internet)...' -ForegroundColor Cyan
        Copy-Item -LiteralPath $source -Destination $partial -ErrorAction Stop
    } elseif ($AllowDownload) {
        Write-Host 'Descargando Pose Lite oficial (solo porque se autorizo -AllowDownload)...' -ForegroundColor Cyan
        Invoke-WebRequest -Uri $uri -OutFile $partial -UseBasicParsing -TimeoutSec 120
    } else {
        throw 'No se encontro Pose Lite en NEXT. Solo si deseas descargarlo: .\scripts\instalar-modelo-pose-rc02.ps1 -AllowDownload'
    }
    if (!(Test-OfficialPose $partial)) { throw 'Hash SHA256 o tamano inesperado: copia descartada.' }
    Move-Item -LiteralPath $partial -Destination $target -ErrorAction Stop
    Write-Host '[LUMIA RC02] Pose Lite instalado en QA, hash verificado. Operacion offline habilitada.' -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
}
