#requires -Version 5.1
<#
  LUMIA / AV-01B - Publicar el rostro en la rama consolidada.
  Ejecutar desde la carpeta extraida del paquete donde se encuentra lumia.glb.
  Crea una CLONACION NUEVA: no toca la instalacion original, TL01 ni main.
#>
param(
  [string]$ClonePath = 'C:\ORBI CODEX\orbi-jarvis-agent-lab-LUMIA-RELEASE'
)
$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/ingeniusvictor/orbi-jarvis-agent-lab.git'
$Branch = 'feature/lumia-consolidated-release-20261028'
$ExpectedHash = 'a1d48cb762fb00ecb2e89270ca7755b7ad7ac1e7e384e0cc21a796494418f56f'
$Source = Join-Path $PSScriptRoot 'lumia.glb'
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
  throw 'Falta lumia.glb. Extrae el paquete COMPLETO antes de ejecutar.'
}
$ActualHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualHash -ne $ExpectedHash) {
  throw 'El GLB no coincide con el rostro facial AV-01B certificado. No se publico nada.'
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git no esta instalado o no esta disponible en PATH.'
}
if (Test-Path -LiteralPath $ClonePath) {
  throw "La carpeta de clonacion YA existe: $ClonePath. Por seguridad no se modifica."
}
$Parent = Split-Path -Path $ClonePath -Parent
if (-not (Test-Path -LiteralPath $Parent)) {
  New-Item -ItemType Directory -Path $Parent -Force | Out-Null
}
Write-Host 'Clonando SOLO la rama experimental, sin modificar main...' -ForegroundColor Cyan
& git clone --single-branch --branch $Branch $Repo $ClonePath
if ($LASTEXITCODE -ne 0) { throw 'Git clone fallo; el rostro original permanece intacto.' }
$Target = Join-Path $ClonePath 'public\models\lumia\lumia.glb'
$TargetDir = Split-Path -Path $Target -Parent
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
Copy-Item -LiteralPath $Source -Destination $Target -ErrorAction Stop
$CopiedHash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($CopiedHash -ne $ExpectedHash) { throw 'El archivo copiado no coincide. No se publica.' }
$Current = (& git -C $ClonePath branch --show-current).Trim()
if ($Current -ne $Branch) { throw "Rama inesperada: $Current. No se publica." }
$Status = @(& git -C $ClonePath status --porcelain)
if ($Status.Count -ne 0 -and $Status.Count -ne 1) {
  throw 'La clonacion tiene cambios adicionales. No se publica.'
}
& git -C $ClonePath add -f -- 'public/models/lumia/lumia.glb'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el archivo para Git.' }
& git -C $ClonePath commit -m 'assets(lumia): include verified AV-01B face avatar GLB'
if ($LASTEXITCODE -ne 0) {
  throw 'Git commit fallo. Verifica que Git tenga nombre y correo configurados.'
}
Write-Host 'Publicando la rama experimental, NO main...' -ForegroundColor Yellow
& git -C $ClonePath push origin "HEAD:refs/heads/$Branch"
if ($LASTEXITCODE -ne 0) {
  throw 'El commit existe en la clonacion, pero el push fallo. Revisa credenciales GitHub.'
}
Write-Host ''
Write-Host 'OK: NUEVO ROSTRO 3D AV-01B INCLUIDO EN LA RAMA EXPERIMENTAL DE GITHUB.' -ForegroundColor Green
Write-Host "Rama: $Branch"
Write-Host "Archivo: public/models/lumia/lumia.glb"
Write-Host "SHA256: $ExpectedHash"
Write-Host 'No se modifico main ni ninguna otra instalacion LUMIA.'
