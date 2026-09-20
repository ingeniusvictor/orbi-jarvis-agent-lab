import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const pidFile = resolve(root, '.local-runtime', 'lumia-desktop.pid.json')

function killTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  const result = spawnSync(
    'taskkill.exe',
    ['/PID', String(pid), '/T', '/F'],
    {
      cwd: root,
      windowsHide: true,
      stdio: 'ignore',
      timeout: 10_000,
    },
  )
  return result.status === 0
}

function recordedPid() {
  if (!existsSync(pidFile)) return 0
  try {
    return Number(JSON.parse(readFileSync(pidFile, 'utf8'))?.pid) || 0
  } catch {
    return 0
  }
}

function discoverLumiaParents() {
  if (process.platform !== 'win32') return []

  const escapedRoot = root.replace(/'/g, "''")
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$root='${escapedRoot}'`,
    "$matches=Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -match '^node(?:\.exe)?$' -and",
    "  $_.CommandLine -and",
    "  $_.CommandLine -like ('*' + $root + '*') -and",
    "  $_.CommandLine -like '*scripts/start.mjs*' -and",
    "  $_.CommandLine -like '*--lumia*'",
    "}",
    "$matches | ForEach-Object { [Console]::WriteLine($_.ProcessId) }",
  ].join('; ')

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    },
  )

  if (result.status !== 0) return []

  return String(result.stdout ?? '')
    .split(/\r?\n/)
    .map((value) => Number(value.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0)
}

const killed = new Set()
const pid = recordedPid()
if (pid && killTree(pid)) killed.add(pid)

// The PID file can become stale after a crash or an older launcher build.
// Fall back only to the exact L.U.M.I.A. parent command inside this repository;
// never kill arbitrary node.exe or Ollama processes.
for (const discovered of discoverLumiaParents()) {
  if (killed.has(discovered)) continue
  if (killTree(discovered)) killed.add(discovered)
}

try {
  rmSync(pidFile, { force: true })
} catch {
  // best effort
}

// Give the hidden shortcut a useful exit code for future diagnostics.
process.exitCode = killed.size > 0 ? 0 : 0
