param(
  [Parameter(Mandatory=$false)][string]$KitZip = "",
  [Parameter(Mandatory=$false)][string]$VrmPath = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root "public\models\lumia-motion"
$dest = Join-Path $destDir "LUMIA_VITA_NATURAL_V05.vrm"
$expected = "f2e68b5379d8e16e8ef2a5cd4a51468b0ceff5a95966f948ca0e46d3421ac8a6"
$expectedBytes = 18058700
if (($KitZip -eq "") -and ($VrmPath -eq "")) {
  throw "Indica -KitZip (ZIP Motion R8) o -VrmPath (archivo VRM aprobado)."
}
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
if ($VrmPath -ne "") {
  Copy-Item -LiteralPath $VrmPath -Destination $dest -Force
} else {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $path = (Resolve-Path -LiteralPath $KitZip).Path
  $archive = [System.IO.Compression.ZipFile]::OpenRead($path)
  try {
    $entry = $archive.Entries | Where-Object { $_.FullName -eq "LUMIA_VITA_NATURAL_V05.vrm" } | Select-Object -First 1
    if ($null -eq $entry) { throw "ZIP no contiene LUMIA_VITA_NATURAL_V05.vrm en la raiz." }
    $inputStream = $entry.Open()
    $outputStream = [System.IO.File]::Create($dest)
    try { $inputStream.CopyTo($outputStream) }
    finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $archive.Dispose() }
}
$f = Get-Item -LiteralPath $dest
$hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
if ($f.Length -ne $expectedBytes -or $hash -ne $expected) {
  Remove-Item -LiteralPath $dest -Force
  throw "El VRM no coincide con el baseline aprobado R8. Instalacion cancelada."
}
Write-Host ("OK: VRM oficial aprobado local: " + $dest) -ForegroundColor Green
Write-Host ("SHA-256: " + $hash) -ForegroundColor Cyan
Write-Host "Prueba Portal Head con ?lumiaAvatar=head-vrm . Retroceso: ?lumiaAvatar=legacy" -ForegroundColor Yellow
Write-Host "No subas este archivo VRM al repositorio publico." -ForegroundColor Yellow
