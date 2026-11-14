<#
LUMIA Motion R9 — installer and launcher for a separate ASUS QA checkout.
Only copies original private VRM/FBX from the user's own LUMIA-ASUS directory,
checks authentic bytes against the R8 manifest, and points the QA session to
the ORIGINAL local Whisper/Kokoro weights without duplicating or editing them.

Use after cloning the experimental branch to %USERPROFILE%\LUMIA-R9-QA:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\PREPARAR_LUMIA_MOTION_R9_ASUS_QA.ps1" -Mode Install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\PREPARAR_LUMIA_MOTION_R9_ASUS_QA.ps1" -Mode Launch

Never performs git pull, checkout, delete, model download or API key copy.
#>
[CmdletBinding()]
param(
  [ValidateSet('Install','Verify','Launch','Ports')]
  [string]$Mode = 'Install',
  [string]$Source = (Join-Path $env:USERPROFILE 'LUMIA-ASUS'),
  [ValidateRange(0,65535)]
  [int]$FrontendPort = 0
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$qaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = [IO.Path]::GetFullPath($Source)
$expectedBranch = 'feature/lumia-motion-r9-intent-contract-20261114'
$manifestFile = Join-Path $PSScriptRoot 'lumia-motion-r8-private-clips-manifest.json'

function Assert-File([string]$Path, [string]$Label) {
  if (-not [IO.File]::Exists($Path)) {
    throw ("Falta " + $Label + ": " + $Path)
  }
}
function Verify-Asset([string]$Path, $Meta, [string]$Label, [switch]$IncompleteWaving) {
  Assert-File $Path $Label
  $bytes = (Get-Item -LiteralPath $Path).Length
  if ($bytes -ne [int64]$Meta.bytes) {
    throw ("Tamano incorrecto: " + $Label + " (esperado " + $Meta.bytes + ")")
  }
  $digest = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if (-not $IncompleteWaving) {
    if ($digest -ne [string]$Meta.sha256) {
      throw ("SHA-256 incorrecto para " + $Label + ". No se copiara.")
    }
  } else {
    if (([string]$Meta.sha256).Length -ne 56) {
      throw 'Se esperaba manifiesto historico Waving con SHA incompleto.'
    }
  }
  return $digest
}
function Copy-Verified([string]$From, [string]$To, [string]$Label) {
  if (Test-Path -LiteralPath $To) {
    if (-not [IO.File]::Exists($To)) { throw ("Destino no es archivo: " + $To) }
    $a = (Get-FileHash -LiteralPath $From -Algorithm SHA256).Hash
    $b = (Get-FileHash -LiteralPath $To -Algorithm SHA256).Hash
    if ($a -ne $b) { throw ("Destino diferente. No se sobrescribe: " + $Label) }
    Write-Host ("OK sin duplicar: " + $Label) -ForegroundColor DarkGreen
    return
  }
  $dir = Split-Path -Parent $To
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Copy-Item -LiteralPath $From -Destination $To -ErrorAction Stop
  $a = (Get-FileHash -LiteralPath $From -Algorithm SHA256).Hash
  $b = (Get-FileHash -LiteralPath $To -Algorithm SHA256).Hash
  if ($a -ne $b) { throw ("Copia no coincide con origen: " + $Label) }
  Write-Host ("OK: " + $Label) -ForegroundColor Green
}
function Resolve-VoiceTools {
  $runtime = Join-Path $sourceRoot '.local-runtime'
  $whisperExe = @(
    (Join-Path $runtime 'whisper.cpp\bin\Release\whisper-cli.exe'),
    (Join-Path $runtime 'whisper.cpp\build\bin\Release\whisper-cli.exe'),
    (Join-Path $runtime 'whisper.cpp\main.exe')
  ) | Where-Object { [IO.File]::Exists($_) } | Select-Object -First 1
  $whisperModel = @(
    (Join-Path $runtime 'whisper.cpp\models\ggml-base.bin'),
    (Join-Path $runtime 'whisper.cpp\models\ggml-small.bin'),
    (Join-Path $runtime 'whisper.cpp\models\ggml-base.en.bin')
  ) | Where-Object { [IO.File]::Exists($_) } | Select-Object -First 1
  $kokoroPython = Join-Path $runtime 'kokoro\.venv\Scripts\python.exe'
  $kokoroModel = Join-Path $runtime 'kokoro\models\kokoro-v1.0.onnx'
  $kokoroVoices = Join-Path $runtime 'kokoro\models\voices-v1.0.bin'
  foreach ($item in @(
    @{Path=$whisperExe; Label='Whisper CLI original'},
    @{Path=$whisperModel; Label='modelo Whisper original'},
    @{Path=$kokoroPython; Label='Python Kokoro original'},
    @{Path=$kokoroModel; Label='modelo ONNX Kokoro original'},
    @{Path=$kokoroVoices; Label='voces Kokoro originales'}
  )) {
    if (-not $item.Path -or -not [IO.File]::Exists([string]$item.Path)) {
      throw ("No se encontro " + $item.Label + " dentro de " + $runtime +
        ". No se descarga ni instala otra voz. Verificar la ruta -Source.")
    }
  }
  return @{
    'ORBI_LOCAL_STT_COMMAND'=$whisperExe
    'ORBI_LOCAL_STT_MODEL'=$whisperModel
    'ORBI_LOCAL_TTS_PYTHON'=$kokoroPython
    'ORBI_LOCAL_TTS_MODEL'=$kokoroModel
    'ORBI_LOCAL_TTS_VOICES'=$kokoroVoices
  }
}
function Select-QAFrontendPort([int]$FrontendPort) {
  # R9 experiment only: honor existing applications on 5173 and 5183.
  # The frontend can use any unoccupied localhost port in the trusted dev range;
  # the backend remains on 8787. No processes are terminated.
  $busyPorts = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty LocalPort -Unique)
  if ($busyPorts -contains 8787) {
    throw 'El bridge necesita 8787, que esta ocupado. No se cerrara ningun proceso; libera el bridge anterior antes de iniciar R9.'
  }
  $candidates = @(5190..5199) + @(5174..5182) + @(5184..5189)
  if ($FrontendPort -ne 0) {
    if ($FrontendPort -lt 5174 -or $FrontendPort -gt 5199 -or $FrontendPort -eq 5183) {
      throw 'Puerto frontend no admitido: usa 5174-5199, excepto el 5183 reservado. 5173 tambien se conserva.'
    }
    $candidates = @($FrontendPort)
  }
  $chosen = @($candidates | Where-Object { $busyPorts -notcontains $_ } |
    Select-Object -First 1)
  if ($chosen.Count -ne 1) {
    throw 'No hay un puerto frontend disponible en 5174-5199 (excluyendo 5183). No se cerro ningun proceso.'
  }
  return [int]$chosen[0]

}

function Verify-SourceAssets {
  Assert-File $manifestFile 'manifiesto R8'
  $m = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  $vrm = Join-Path $sourceRoot 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm'
  Verify-Asset $vrm $m.vrm 'VRM original' | Out-Null
  $clipRoot = Join-Path $sourceRoot 'public\models\lumia-motion\clips'
  $entries = @($m.clips.PSObject.Properties)
  if ($entries.Count -ne 17) { throw ("Manifiesto esperaba 17 clips, encontro " + $entries.Count) }
  $wavingDigest = $null
  foreach ($entry in $entries) {
    $name = [string]$entry.Name
    $path = Join-Path $clipRoot $name
    if ($name -eq 'Waving.fbx') {
      $wavingDigest = Verify-Asset $path $entry.Value $name -IncompleteWaving
    } else {
      Verify-Asset $path $entry.Value $name | Out-Null
    }
  }

  # Legacy manifest Waving.fbx has an INVALID 56-character digest. When the
  # original verified ZIP is present, independently certify the complete SHA
  # against its archived Waving bytes. Never treat 56 chars as a SHA prefix.
  $kit = Join-Path $env:USERPROFILE 'Downloads\LUMIA_VITA_NATURAL_V085_R8_NATURAL_CONVERSATION_KIT.zip'
  $wavingCertified = $false
  if ([IO.File]::Exists($kit)) {
    $zipSha = (Get-FileHash -LiteralPath $kit -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($zipSha -eq [string]$m.kitSha256) {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [IO.Compression.ZipFile]::OpenRead($kit)
      try {
        $matches = @($archive.Entries | Where-Object {
          $part = $_.FullName.Replace('\','/')
          $part -eq 'clips/Waving.fbx' -or $part.EndsWith('/clips/Waving.fbx', [StringComparison]::Ordinal)
        })
        if ($matches.Count -ne 1) { throw 'Waving.fbx ausente/duplicado en ZIP certificado.' }
        $stream = $matches[0].Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $archivedDigest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose(); $stream.Dispose() }
        if ($archivedDigest -ne $wavingDigest) {
          throw 'Waving.fbx original no coincide con ZIP certificado.'
        }
        $wavingCertified = $true
      } finally { $archive.Dispose() }
    } else {
      Write-Warning 'ZIP presente pero su hash NO corresponde al manifiesto; no se usara.'
    }
  }
  if (-not $wavingCertified) {
    Write-Warning 'Waving.fbx: SHA del manifiesto incompleto y ZIP certificado no disponible. Se comprobo tamano y luego igualdad de copia, NO procedencia criptografica.'
  }
  return @{ Manifest=$m; Vrm=$vrm; ClipRoot=$clipRoot; WavingCertified=$wavingCertified }
}

if (-not [IO.Directory]::Exists($sourceRoot)) { throw ("Carpeta original inexistente: " + $sourceRoot) }
if ([string]::Equals($qaRoot,$sourceRoot,[StringComparison]::OrdinalIgnoreCase)) {
  throw 'La copia QA y LUMIA-ASUS apuntan a la misma carpeta. Cancelado.'
}
Assert-File (Join-Path $qaRoot 'package.json') 'package.json de la copia R9'
Assert-File (Join-Path $qaRoot 'src\scene\lumia-motion-r9\expressive-blend.js') 'R9-02'
if (-not (Test-Path -LiteralPath (Join-Path $qaRoot '.git'))) {
  throw 'La carpeta QA debe ser un clon Git independiente.'
}
$actualBranch = (& git -C $qaRoot branch --show-current)
if ($LASTEXITCODE -ne 0 -or $actualBranch.Trim() -ne $expectedBranch) {
  throw ("Rama incorrecta. Esperada: " + $expectedBranch + ". Actual: " + $actualBranch)
}
$origin = (& git -C $qaRoot remote get-url origin)
if ($LASTEXITCODE -ne 0 -or $origin -notmatch '(^https://github[.]com/ingeniusvictor/orbi-jarvis-agent-lab([.]git)?$|^git@github[.]com:ingeniusvictor/orbi-jarvis-agent-lab[.]git$)') {
  throw 'Remote origin inesperado. No se ejecutara el instalador.'
}

if ($Mode -eq 'Install') {
  Write-Host 'LUMIA R9 QA: preparando una COPIA, LUMIA-ASUS original solo lectura.' -ForegroundColor Cyan
  $asset = Verify-SourceAssets
  $voice = Resolve-VoiceTools
  $vrmDest = Join-Path $qaRoot 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm'
  Copy-Verified $asset.Vrm $vrmDest 'VRM R8'
  foreach ($entry in @($asset.Manifest.clips.PSObject.Properties)) {
    $name = [string]$entry.Name
    Copy-Verified (Join-Path $asset.ClipRoot $name) (Join-Path $qaRoot ('public\models\lumia-motion\clips\' + $name)) $name
  }
  $legacy = Join-Path $sourceRoot 'public\models\lumia\lumia.glb'
  if ([IO.File]::Exists($legacy)) {
    Copy-Verified $legacy (Join-Path $qaRoot 'public\models\lumia\lumia.glb') 'GLB legacy de respaldo'
  } else {
    Write-Warning 'GLB legacy no encontrado; la prueba R9 necesita el VRM, pero el fallback visual anterior no estara disponible.'
  }
  Write-Host 'Whisper y Kokoro permaneceran en la carpeta original. No se copiaran pesos ni entornos Python.' -ForegroundColor Cyan
  Push-Location $qaRoot
  try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci fallo en copia QA.' }
  } finally { Pop-Location }
  Write-Host 'INSTALACION QA TERMINADA. Ejecutar -Mode Verify y despues -Mode Launch.' -ForegroundColor Green
} elseif ($Mode -eq 'Verify') {
  Verify-SourceAssets | Out-Null
  $null = Resolve-VoiceTools
  foreach ($item in @(
    (Join-Path $qaRoot 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm'),
    (Join-Path $qaRoot 'node_modules\vite\bin\vite.js')
  )) { Assert-File $item 'asset/dependencia QA' }
  Push-Location $qaRoot
  try {
    foreach ($cmd in @(
      'scripts/certify-lumia-motion-r9-contract.mjs',
      'scripts/certify-lumia-motion-r9-director.mjs'
    )) {
      & node $cmd
      if ($LASTEXITCODE -ne 0) { throw ("Fallo test: " + $cmd) }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'La compilacion R9 no paso.' }
  } finally { Pop-Location }
  Write-Host 'QA LOCAL DE CODIGO PASS. Todavia falta revision visual humana.' -ForegroundColor Green
} elseif ($Mode -eq 'Ports') {
  # Read-only port probe for CI and local diagnostics. Never launches LUMIA.
  Select-QAFrontendPort -FrontendPort $FrontendPort
} else {
  # Launch without changing Windows environment globally. The existing
  # certified ASUS starter sets all usual Ollama/Whisper/Kokoro flags.
  $voice = Resolve-VoiceTools
  Assert-File (Join-Path $qaRoot 'public\models\lumia-motion\LUMIA_VITA_NATURAL_V05.vrm') 'VRM en QA'
  Assert-File (Join-Path $qaRoot 'node_modules\vite\bin\vite.js') 'npm ci en QA'
  foreach ($key in $voice.Keys) { [Environment]::SetEnvironmentVariable($key, [string]$voice[$key], 'Process') }
  [Environment]::SetEnvironmentVariable('JARVIS_ALLOW_WRITES', '0', 'Process')
  [Environment]::SetEnvironmentVariable('ORBIA_REALTIME_EXPERIMENT', '0', 'Process')
  [Environment]::SetEnvironmentVariable('VITE_LUMIA_REALTIME_EXPERIMENT', '0', 'Process')
  $front = Select-QAFrontendPort -FrontendPort $FrontendPort
  [Environment]::SetEnvironmentVariable('PORT', [string]$front, 'Process')
  [Environment]::SetEnvironmentVariable('JARVIS_BRIDGE_PORT', '8787', 'Process')
  Write-Host ''
  Write-Host ('LUMIA R9 QA: frontend ' + $front + ' / bridge 8787. Puertos 5173 y 5183 intactos.') -ForegroundColor Green
  Write-Host ('R9 ACTIVO: http://localhost:' + $front + '/?lumiaAvatar=bust-vrm&lumiaR9=1') -ForegroundColor Cyan
  Write-Host ('CONTROL R8: http://localhost:' + $front + '/?lumiaAvatar=bust-vrm&lumiaR9=0') -ForegroundColor Cyan
  Write-Host 'Moverse entre URLs recarga el visor. No lanzar otra instancia de bridge en 8787.' -ForegroundColor Yellow
  Push-Location $qaRoot
  try {
    & (Join-Path $qaRoot 'INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
    if ($LASTEXITCODE -ne 0) { throw ("El lanzador QA termino con codigo " + $LASTEXITCODE) }
  } finally { Pop-Location }
}
