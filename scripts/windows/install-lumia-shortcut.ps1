param(
  [string]$RepoPath = "C:\ORBI CODEX\orbi-jarvis-agent-lab"
)

$ErrorActionPreference = 'Stop'
$Launcher = Join-Path $RepoPath 'scripts\windows\start-lumia-latest.vbs'
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'L.U.M.I.A. - ORBI.lnk'
$Wscript = Join-Path $env:WINDIR 'System32\wscript.exe'

if (-not (Test-Path -LiteralPath $Launcher)) {
  throw "Launcher not found at $Launcher. Run git pull first."
}

$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $Wscript
$shortcut.Arguments = '"' + $Launcher + '"'
$shortcut.WorkingDirectory = $RepoPath
$shortcut.Description = 'Abrir L.U.M.I.A. en su última versión disponible'

# Use the browser/application icon already present on Windows when no custom ICO
# has been installed yet. This can be replaced later by an official L.U.M.I.A. icon.
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($chrome) {
  $shortcut.IconLocation = "$chrome,0"
} else {
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
}

$shortcut.Save()

Write-Host ""
Write-Host "L.U.M.I.A. desktop shortcut created:" -ForegroundColor Cyan
Write-Host "  $ShortcutPath"
Write-Host ""
Write-Host "From now on, double-click the shortcut. It will:" -ForegroundColor Green
Write-Host "  1. Update the repository with git pull --ff-only"
Write-Host "  2. Start Ollama if needed"
Write-Host "  3. Install npm dependencies only when package-lock changed"
Write-Host "  4. Start L.U.M.I.A. hidden"
Write-Host "  5. Open http://127.0.0.1:5173 automatically"
Write-Host ""
Write-Host "If L.U.M.I.A. is already running, the shortcut only reopens it."
