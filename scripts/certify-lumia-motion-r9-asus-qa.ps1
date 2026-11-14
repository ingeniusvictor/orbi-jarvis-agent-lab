# Windows-only, SYNTHETIC fixture. No real VRM, FBX or voice weights.
# Verifies the ASUS bootstrap without accessing the owner's PC.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path -Parent $PSScriptRoot
$branch = 'feature/lumia-motion-r9-intent-contract-20261114'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('lumia-r9-asus-smoke-' + [guid]::NewGuid().ToString('N'))
$source = Join-Path $temp 'LUMIA-ASUS-SIMULATED'
$qa = Join-Path $temp 'LUMIA-R9-QA'
$expectedOrigin='https://github.com/ingeniusvictor/orbi-jarvis-agent-lab.git'
function Put-Text([string]$Path,[string]$Value){
  New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
  [IO.File]::WriteAllText($Path,$Value,[Text.Encoding]::UTF8)
}
function Hash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
try {
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  & git -C $repo clone --local --branch $branch --single-branch $repo $qa
  if($LASTEXITCODE -ne 0){throw 'Fake QA git clone failed'}
  & git -C $qa remote set-url origin $expectedOrigin
  if($LASTEXITCODE -ne 0){throw 'Fake QA git origin setup failed'}

  $manifestFile=Join-Path $qa 'scripts\lumia-motion-r8-private-clips-manifest.json'
  $manifest=Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  $vrm=Join-Path $source 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm'
  Put-Text $vrm 'R9_SYNTHETIC_VRM_NOT_REAL'
  $manifest.vrm.bytes=(Get-Item -LiteralPath $vrm).Length
  $manifest.vrm.sha256=Hash $vrm
  $clipDir=Join-Path $source 'public\models\lumia-motion\clips'
  foreach($item in @($manifest.clips.PSObject.Properties)){
    $file=Join-Path $clipDir ([string]$item.Name)
    Put-Text $file ('R9_SYNTHETIC_FBX_NOT_REAL_'+$item.Name)
    $item.Value.bytes=(Get-Item -LiteralPath $file).Length
    $item.Value.sha256=if($item.Name -eq 'Waving.fbx'){('0' * 56)}else{Hash $file}
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestFile -Encoding utf8

  # Fake existence only; the installer never EXECUTES these mock weights.
  $runtime=Join-Path $source '.local-runtime'
  foreach($file in @(
    'whisper.cpp\bin\Release\whisper-cli.exe',
    'whisper.cpp\models\ggml-base.bin',
    'kokoro\.venv\Scripts\python.exe',
    'kokoro\models\kokoro-v1.0.onnx',
    'kokoro\models\voices-v1.0.bin'
  )){ Put-Text (Join-Path $runtime $file) 'R9_DUMMY_ONLY' }
  $vrmBefore=Hash $vrm
  $clipsBefore=@{}
  foreach($item in @($manifest.clips.PSObject.Properties)){
    $name=[string]$item.Name
    $clipsBefore[$name]=Hash (Join-Path $clipDir $name)
  }

  $installer=Join-Path $qa 'scripts\PREPARAR_LUMIA_MOTION_R9_ASUS_QA.ps1'
  # Emulate occupied frontend + bridge ports using local dummy listeners.
  $frontListener=$null
  $bridgeListener=$null
  $bound=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty LocalPort -Unique)
  if($bound -notcontains 5190){
    $frontListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,5190)
    $frontListener.Start()
  }
  if($bound -notcontains 8790){
    $bridgeListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,8790)
    $bridgeListener.Start()
  }
  try {
    $ports=& $installer -Mode Ports -Source $source
    $selected=[int]$ports.Frontend
    $selectedBridge=[int]$ports.Bridge
    if($selected -eq 5190 -or $selected -eq 5173 -or $selected -eq 5183){
      throw ('Reserved or occupied frontend port selected: '+$selected)
    }
    if($selectedBridge -eq 8790 -or $selectedBridge -eq 8787){
      throw ('Reserved or occupied bridge port selected: '+$selectedBridge)
    }
    $reservedRejected=$false
    try { & $installer -Mode Ports -Source $source -FrontendPort 5183 | Out-Null } catch {
      if($_.Exception.Message -match 'no admitido'){$reservedRejected=$true}else{throw}
    }
    if(-not $reservedRejected){throw 'Reserved frontend port 5183 was accepted'}
    $occupiedRejected=$false
    try { & $installer -Mode Ports -Source $source -FrontendPort 5190 | Out-Null } catch {
      if($_.Exception.Message -match 'No hay frontend'){$occupiedRejected=$true}else{throw}
    }
    if(-not $occupiedRejected){throw 'Occupied frontend port 5190 was accepted'}
    Write-Host ('R9 isolated port selection PASS: frontend '+$selected+' bridge '+$selectedBridge+'; preserved 5173, 5183, 8787.')
  } finally {
    if($frontListener){$frontListener.Stop()}
    if($bridgeListener){$bridgeListener.Stop()}
  }
  $errors=$null;$tokens=$null
  [Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$errors)|Out-Null
  if(@($errors).Count){throw ('PowerShell parser errors: '+(@($errors)|Out-String))}
  & $installer -Mode Install -Source $source
  if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw 'Install command failed'}
  $copy=Join-Path $qa 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm'
  if((Hash $copy) -ne $vrmBefore){throw 'VRM copy mismatch'}
  $items=@(Get-ChildItem -LiteralPath (Join-Path $qa 'public\models\lumia-motion\clips') -Filter '*.fbx' -File)
  if($items.Count -ne 17){throw 'Expected 17 synthetic clips'}
  foreach($file in $items){
    if((Hash $file.FullName) -ne $clipsBefore[$file.Name]){throw ('Clip mismatch '+$file.Name)}
  }
  if((Hash $vrm) -ne $vrmBefore){throw 'Original VRM was modified'}
  foreach($name in $clipsBefore.Keys){
    if((Hash (Join-Path $clipDir $name)) -ne $clipsBefore[$name]){throw ('Original FBX modified: '+$name)}
  }

  # No overwrites: tamper the QA file; installer MUST reject.
  Put-Text (Join-Path $qa 'public\models\lumia-motion\clips\No.fbx') 'TAMPERED_QA_ONLY'
  $rejected=$false
  try { & $installer -Mode Install -Source $source } catch {
    if($_.Exception.Message -match 'No se sobrescribe'){$rejected=$true}else{throw}
  }
  if(-not $rejected){throw 'Installer overwrote tampered QA clip'}
  if((Get-Content -LiteralPath (Join-Path $qa 'public\models\lumia-motion\clips\No.fbx') -Raw) -notmatch 'TAMPERED_QA_ONLY'){
    throw 'Tampered target was overwritten'
  }

  Write-Host 'LUMIA R9 ASUS QA BOOTSTRAP SYNTHETIC PASS: 17 clips, VRM hash, source immutable, tamper block, shared runtime references.' -ForegroundColor Green
} finally {
  if(Test-Path -LiteralPath $temp){ Remove-Item -LiteralPath $temp -Recurse -Force }
}
