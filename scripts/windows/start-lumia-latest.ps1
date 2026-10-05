param(
  [string]$RepoPath = "C:\ORBI CODEX\orbi-jarvis-agent-lab"
)

$ErrorActionPreference = 'Stop'
$Branch = 'feature/orbia-lumia-convergence-foundation'
$FaceUrl = 'http://127.0.0.1:5173'
$BridgeHealth = 'http://127.0.0.1:8787/health'
$LogRoot = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA'
$LogFile = Join-Path $LogRoot 'launcher.log'

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

function Write-LauncherLog([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
  Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Test-HttpReady([string]$Url, [int]$TimeoutSec = 2) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Find-OllamaApp {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\Ollama.exe'),
    (Join-Path $env:LOCALAPPDATA 'Ollama\Ollama.exe')
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

function Ensure-Ollama {
  if (Test-HttpReady 'http://127.0.0.1:11434/api/tags' 1) {
    Write-LauncherLog 'Ollama already ready.'
    return $true
  }

  $app = Find-OllamaApp
  if ($app) {
    Write-LauncherLog "Starting Ollama: $app"
    Start-Process -FilePath $app -WindowStyle Hidden | Out-Null
  } else {
    Write-LauncherLog 'Ollama app executable not found; trying ollama serve.'
    $ollama = Get-Command ollama -ErrorAction SilentlyContinue
    if ($ollama) {
      Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    } else {
      Write-LauncherLog 'Ollama is not installed or not in PATH.'
      return $false
    }
  }

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady 'http://127.0.0.1:11434/api/tags' 1) {
      Write-LauncherLog 'Ollama became ready.'
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  Write-LauncherLog 'Timed out waiting for Ollama.'
  return $false
}

function Update-Lumia {
  Set-Location -LiteralPath $RepoPath

  $git = Get-Command git -ErrorAction Stop
  $npm = Get-Command npm.cmd -ErrorAction Stop

  $dirty = (& $git.Source status --porcelain 2>$null)
  if ($dirty) {
    Write-LauncherLog 'Working tree has local changes; skipping automatic git pull to protect them.'
    return
  }

  $beforeLock = if (Test-Path 'package-lock.json') { (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash } else { '' }

  Write-LauncherLog "Updating $Branch with git pull --ff-only."
  & $git.Source checkout $Branch *> $null
  & $git.Source pull --ff-only origin $Branch *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-LauncherLog 'git pull failed; launching the currently installed version.'
    return
  }

  $afterLock = if (Test-Path 'package-lock.json') { (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash } else { '' }
  $needsInstall = -not (Test-Path 'node_modules') -or ($beforeLock -ne $afterLock)

  if ($needsInstall) {
    Write-LauncherLog 'Dependencies changed or node_modules is missing; running npm install.'
    & $npm.Source install --no-audit --no-fund *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-LauncherLog 'npm install failed; continuing with current local dependencies.'
    }
  }
}

try {
  Write-LauncherLog '--- L.U.M.I.A. launcher invoked ---'

  if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "Repository not found at $RepoPath"
  }

  # If L.U.M.I.A. is already running, do not create duplicate bridge/Vite processes.
  if ((Test-HttpReady $BridgeHealth 1) -and (Test-HttpReady $FaceUrl 1)) {
    Write-LauncherLog 'L.U.M.I.A. already running; opening existing session.'
    Start-Process $FaceUrl | Out-Null
    exit 0
  }

  Update-Lumia

  if (-not (Ensure-Ollama)) {
    Write-LauncherLog 'Ollama was not ready; launch aborted.'
    exit 2
  }

  Set-Location -LiteralPath $RepoPath
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $stdout = Join-Path $LogRoot 'lumia-runtime.out.log'
  $stderr = Join-Path $LogRoot 'lumia-runtime.err.log'

  Write-LauncherLog 'Starting npm run start:lumia hidden.'
  Start-Process `
    -FilePath $npm `
    -ArgumentList @('run', 'start:lumia') `
    -WorkingDirectory $RepoPath `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr | Out-Null

  $deadline = (Get-Date).AddSeconds(35)
  while ((Get-Date) -lt $deadline) {
    if ((Test-HttpReady $BridgeHealth 1) -and (Test-HttpReady $FaceUrl 1)) {
      Write-LauncherLog 'L.U.M.I.A. ready; opening browser.'
      Start-Process $FaceUrl | Out-Null
      exit 0
    }
    Start-Sleep -Milliseconds 500
  }

  Write-LauncherLog 'Timed out waiting for L.U.M.I.A. to become ready.'
  exit 3
} catch {
  Write-LauncherLog "Launcher error: $($_.Exception.Message)"
  exit 1
}
