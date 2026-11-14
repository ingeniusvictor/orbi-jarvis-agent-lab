#Requires -Version 5.1
<#
.SYNOPSIS
  LUMIA MASTER LM-00 — inventario local de SOLO LECTURA.
.DESCRIPTION
  No cambia Git, no inicia LUMIA ni modelos, no abre webcam/microfono,
  no instala, descarga, escribe ni exporta archivos. Imprime JSON resumido.
  Evita rutas de archivos privados y no muestra transcripciones, fotos o secretos.
  Esta herramienta NO certifica el funcionamiento de LUMIA.
.EXAMPLE
  powershell -NoProfile -File .\scripts\lumia-master-inventory.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoPath = (Join-Path $env:USERPROFILE "LUMIA-ASUS")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RepoPath -PathType Container)) {
    throw "LUMIA_REPO_NOT_FOUND: compruebe la carpeta indicada."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "GIT_NOT_FOUND"
}

$root = (& git -C $RepoPath rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    throw "LUMIA_NOT_GIT_REPO"
}
$actual = (Resolve-Path -LiteralPath $root).Path
$expected = (Resolve-Path -LiteralPath $RepoPath).Path
if ($actual -ine $expected) {
    throw "LUMIA_UNEXPECTED_GIT_ROOT: el repositorio no coincide con la carpeta solicitada."
}

$sha = (& git -C $expected rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "GIT_COMMIT_UNAVAILABLE" }
$branch = (& git -C $expected branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "GIT_BRANCH_UNAVAILABLE" }
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "(detached HEAD)" }

# Nunca imprimir nombres de archivos sin commit: podrian ser personales.
$pending = @(& git -C $expected status --porcelain --untracked-files=normal)
if ($LASTEXITCODE -ne 0) { throw "GIT_STATUS_UNAVAILABLE" }

$launchers = @(
    Get-ChildItem -LiteralPath $expected -Filter "INICIAR_LUMIA*.cmd" -File |
        Sort-Object Name | ForEach-Object { $_.Name }
)

$hasNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
$hasNpm = $null -ne (Get-Command npm.cmd -ErrorAction SilentlyContinue)
$hasOllama = $null -ne (Get-Command ollama -ErrorAction SilentlyContinue)

$nodeVersion = $null
$npmVersion = $null
if ($hasNode) {
    try { $nodeVersion = (& node --version 2>$null | Select-Object -First 1) }
    catch { $nodeVersion = "error" }
}
if ($hasNpm) {
    try { $npmVersion = (& npm.cmd --version 2>$null | Select-Object -First 1) }
    catch { $npmVersion = "error" }
}

$modelNames = @()
$ollamaStatus = if ($hasOllama) { "installed" } else { "not_found" }
if ($hasOllama) {
    try {
        $listed = @(& ollama list 2>$null)
        if ($LASTEXITCODE -eq 0 -and $listed.Count -ge 1) {
            $modelNames = @(
                $listed | Select-Object -Skip 1 | ForEach-Object {
                    $fields = $_.Trim() -split '\s+'
                    if ($fields.Count -gt 0 -and $fields[0]) { $fields[0] }
                }
            )
            $ollamaStatus = "models_listed"
        } else { $ollamaStatus = "service_unavailable_or_empty" }
    } catch { $ollamaStatus = "list_failed" }
}

# Verificar puertos, no detener procesos ni abrir servicios.
$portStatus = @{}
foreach ($port in @(5173, 8787, 11434)) {
    try {
        $occupied = @(
            Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        )
        $portStatus["$port"] = ($occupied.Count -gt 0)
    } catch {
        $portStatus["$port"] = $null
    }
}

$report = [ordered]@{
    audit = "LUMIA-MASTER-LM00"
    type = "read_only_local_inventory_not_a_certification"
    git = [ordered]@{
        branch = $branch
        commit_full_sha = $sha
        worktree_clean = ($pending.Count -eq 0)
        uncommitted_or_untracked_entry_count = $pending.Count
    }
    launchers = $launchers
    tools = [ordered]@{
        node = $nodeVersion
        npm = $npmVersion
        ollama = $ollamaStatus
        installed_ollama_model_names = $modelNames
    }
    local_listen_ports = $portStatus
    not_tested = @(
        "active_lumia_model_in_running_session",
        "whisper_microphone",
        "kokoro_playback",
        "camera_consent_and_freshness",
        "avatar_visual_render",
        "face_identity_recognition",
        "voice_diarization_integration"
    )
    network_downloads = 0
    files_written = 0
    microphone_accessed = $false
    camera_accessed = $false
    github_mutations = 0
}
$report | ConvertTo-Json -Depth 6
