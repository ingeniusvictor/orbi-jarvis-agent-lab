param(
  [string]$KitZip = (Join-Path $env:USERPROFILE 'Downloads\LUMIA_VITA_NATURAL_V085_R8_NATURAL_CONVERSATION_KIT.zip')
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$manifestPath=Join-Path $PSScriptRoot 'lumia-motion-r8-private-clips-manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$archivePath=(Resolve-Path -LiteralPath $KitZip).Path
$kitHash=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($kitHash -ne $manifest.kitSha256) {
  throw ('El ZIP Motion R8 no coincide con el paquete certificado: ' + $kitHash)
}
$target=Join-Path $repoRoot 'public\models\lumia-motion\clips'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::OpenRead($archivePath)
$staged=@()
$verified=0
try {
  foreach ($clip in $manifest.clips.PSObject.Properties) {
    $name=$clip.Name
    $meta=$clip.Value
    $dest=Join-Path $target $name
    if (Test-Path -LiteralPath $dest) {
      $present=Get-Item -LiteralPath $dest
      $sha=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($present.Length -ne $meta.bytes -or -not $sha.StartsWith([string]$meta.sha256)) {
        throw ('Archivo local distinto del R8 aprobado: ' + $dest + '. No se sobrescribe.')
      }
      $verified++
      continue
    }
    $matches=@($archive.Entries | Where-Object {
      $p=$_.FullName.Replace('\','/')
      $p -eq ('clips/' + $name) -or $p.EndsWith('/clips/' + $name, [StringComparison]::Ordinal)
    })
    if ($matches.Count -ne 1) { throw ('No se encontro un unico clip en ZIP: ' + $name) }
    $tmp=Join-Path $target ([IO.Path]::GetRandomFileName() + '.partial')
    $inputStream=$matches[0].Open()
    $outputStream=[IO.File]::Create($tmp)
    try { $inputStream.CopyTo($outputStream) }
    finally { $outputStream.Dispose(); $inputStream.Dispose() }
    $tmpInfo=Get-Item -LiteralPath $tmp
    $sha=(Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($tmpInfo.Length -ne $meta.bytes -or -not $sha.StartsWith([string]$meta.sha256)) {
      Remove-Item -LiteralPath $tmp -Force
      throw ('El clip no coincide con Motion R8: ' + $name)
    }
    $staged+=@{Tmp=$tmp;Dest=$dest}
    $verified++
  }
  foreach ($item in $staged) { Move-Item -LiteralPath $item.Tmp -Destination $item.Dest }
} finally {
  $archive.Dispose()
  foreach ($item in $staged) {
    if (Test-Path -LiteralPath $item.Tmp) { Remove-Item -LiteralPath $item.Tmp -Force }
  }
}
if ($verified -ne 17) { throw 'Los 17 clips no quedaron verificados.' }
Write-Host ('OK: ' + $verified + '/17 movimientos Motion R8 verificados localmente.') -ForegroundColor Green
Write-Host ('Directorio privado: ' + $target) -ForegroundColor Cyan
Write-Host 'No subir FBX/VRM a GitHub. Inicia LUMIA Body VRM desde el portal.' -ForegroundColor Yellow
