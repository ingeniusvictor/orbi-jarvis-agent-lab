param(
  [string]$KitZip = (Join-Path $env:USERPROFILE 'Downloads\LUMIA_VITA_NATURAL_V085_R8_NATURAL_CONVERSATION_KIT.zip')
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $PSScriptRoot 'lumia-motion-r8-private-clips-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$archivePath = (Resolve-Path -LiteralPath $KitZip).Path
$kitHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($manifest.kitSha256 -notmatch '^[a-f0-9]{64}$' -or $kitHash -ne $manifest.kitSha256) {
  throw ('El ZIP no coincide con el paquete Motion R8 certificado: ' + $kitHash)
}

# The verified complete ZIP digest is the root of trust. The legacy manifest
# has ONLY 56 hexadecimal characters for Waving.fbx, and that historical
# fragment is NOT a reliable SHA-256 prefix. Never invent or trust a suffix.
# Extract each file from the verified ZIP into a temporary path and compute
# its canonical full SHA-256. Compare pre-existing local files to that full
# extracted checksum, avoiding an overwrite if they differ.
$target = Join-Path $repoRoot 'public\models\lumia-motion\clips'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
$staged = @()
$temps = @()
$verified = 0
try {
  foreach ($clip in $manifest.clips.PSObject.Properties) {
    $name = [string]$clip.Name
    $meta = $clip.Value
    $matches = @($archive.Entries | Where-Object {
      $p = $_.FullName.Replace('\','/')
      $p -eq ('clips/' + $name) -or
        $p.EndsWith('/clips/' + $name, [StringComparison]::Ordinal)
    })
    if ($matches.Count -ne 1) { throw ('Se esperaba exactamente un clip R8 en ZIP: ' + $name) }

    $tmp = Join-Path $target ([IO.Path]::GetRandomFileName() + '.partial')
    $temps += $tmp
    $inputStream = $matches[0].Open()
    $outputStream = [IO.File]::Create($tmp)
    try { $inputStream.CopyTo($outputStream) }
    finally { $outputStream.Dispose(); $inputStream.Dispose() }

    $actualBytes = (Get-Item -LiteralPath $tmp).Length
    $sha = (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualBytes -ne [int64]$meta.bytes) {
      throw ('El tamaño extraído no coincide con el catálogo R8: ' + $name)
    }
    $expected = [string]$meta.sha256
    if ($expected -match '^[a-f0-9]{64}$') {
      if ($sha -ne $expected) { throw ('SHA-256 individual incorrecto: ' + $name) }
    } elseif ($name -eq 'Waving.fbx' -and $expected.Length -eq 56) {
      Write-Host ('Waving.fbx: SHA original incompleto; SHA íntegro calculado del ZIP verificado: ' + $sha) -ForegroundColor Yellow
    } else {
      throw ('Metadatos SHA inválidos para: ' + $name)
    }

    $dest = Join-Path $target $name
    if (Test-Path -LiteralPath $dest) {
      $existingBytes = (Get-Item -LiteralPath $dest).Length
      $existingSha = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($existingBytes -ne $actualBytes -or $existingSha -ne $sha) {
        throw ('Ya existe un archivo local distinto al ZIP certificado. No sobrescribir: ' + $dest)
      }
    } else {
      $staged += @{ Tmp = $tmp; Dest = $dest }
    }
    $verified++
  }

  if ($verified -ne 17) { throw ('Solo se validaron ' + $verified + ' de 17 FBX') }
  foreach ($item in $staged) {
    Move-Item -LiteralPath $item.Tmp -Destination $item.Dest -ErrorAction Stop
  }
} finally {
  $archive.Dispose()
  foreach ($temp in $temps) {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
  }
}
Write-Host ('OK: ' + $verified + '/17 FBX Motion R8 originales verificados e instalados localmente.') -ForegroundColor Green
Write-Host ('Directorio privado: ' + $target) -ForegroundColor Cyan
Write-Host 'Los modelos VRM y FBX continuan excluidos de GitHub.' -ForegroundColor Yellow
