# Synthetic verification only. Uses fabricated tiny clip bytes, never private R8 assets.
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$manifestOriginal=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lumia-motion-r8-private-clips-manifest.json') -Raw | ConvertFrom-Json
$temp=Join-Path ([IO.Path]::GetTempPath()) ('lumia-ph03-installer-test-'+[guid]::NewGuid().ToString('N'))
$fixtureRoot=Join-Path $temp 'fixture'
$installer=Join-Path $fixtureRoot 'scripts\INSTALAR_LUMIA_MOTION_R8_BODY.ps1'
$clipSource=Join-Path $temp 'zip-input\bundle\clips'
$zipPath=Join-Path $temp 'fake-verified-kit.zip'
try {
  New-Item -ItemType Directory -Path (Split-Path -Parent $installer),$clipSource -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'INSTALAR_LUMIA_MOTION_R8_BODY.ps1') -Destination $installer
  foreach ($clip in $manifestOriginal.clips.PSObject.Properties) {
    $name=[string]$clip.Name
    $bytes=[Text.Encoding]::UTF8.GetBytes('PH03-FAKE-TEST-ONLY:'+ $name)
    $file=Join-Path $clipSource $name
    [IO.File]::WriteAllBytes($file,$bytes)
    $clip.Value.bytes=$bytes.Length
    $actual=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    # Reproduce the historical failure with a definitely incorrect fragment.
    $clip.Value.sha256=if($name -eq 'Waving.fbx'){('0' * 56)}else{$actual}
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $temp 'zip-input'),$zipPath)
  $manifestOriginal.kitSha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifestOriginal | ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'scripts\lumia-motion-r8-private-clips-manifest.json') -Encoding utf8

  & $installer -KitZip $zipPath | Out-Null
  $dest=Join-Path $fixtureRoot 'public\models\lumia-motion\clips'
  $installed=@(Get-ChildItem -LiteralPath $dest -Filter '*.fbx' -File)
  if($installed.Count -ne 17){throw ('First installation did not produce 17 FBX: '+$installed.Count)}

  # Idempotent: second run must accept byte-identical files.
  & $installer -KitZip $zipPath | Out-Null
  $installed=@(Get-ChildItem -LiteralPath $dest -Filter '*.fbx' -File)
  if($installed.Count -ne 17){throw 'Second installation changed number of clips'}

  # Tampering must never be silently overwritten, even for truncated Waving.
  $waving=Join-Path $dest 'Waving.fbx'
  [IO.File]::WriteAllText($waving,'PH03-TAMPERED-LOCAL-WAVING')
  $rejected=$false
  try {
    & $installer -KitZip $zipPath | Out-Null
  } catch {
    if($_.Exception.Message -match 'archivo local distinto'){$rejected=$true}
    else{throw}
  }
  if(-not $rejected){throw 'Modified Waving was not rejected'}
  if((Get-Content -LiteralPath $waving -Raw) -notmatch 'PH03-TAMPERED'){
    throw 'Installer overwrote an existing modified Waving'
  }

  # An archive with different bytes must fail BEFORE extracting anything.
  $badZip=Join-Path $temp 'bad-kit.zip'
  Copy-Item -LiteralPath $zipPath -Destination $badZip
  [IO.File]::AppendAllText($badZip,'-CORRUPTED')
  $badRejected=$false
  try {
    & $installer -KitZip $badZip | Out-Null
  } catch {
    if($_.Exception.Message -match 'ZIP no coincide'){$badRejected=$true}
    else{throw}
  }
  if(-not $badRejected){throw 'Corrupted ZIP was not rejected'}
  Write-Host 'PH-03 installer regression PASS: complete ZIP SHA, 17 FBX, legacy Waving, idempotency, tamper rejection.' -ForegroundColor Green
} finally {
  if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Recurse -Force}
}
