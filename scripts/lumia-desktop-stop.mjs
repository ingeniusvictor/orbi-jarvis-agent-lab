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

function bridgeListenerPids() {
  const result = spawnSync(
    'netstat.exe',
    ['-ano', '-p', 'tcp'],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    },
  )
  if (result.status !== 0) return []

  const pids = new Set()
  for (const line of String(result.stdout ?? '').split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue
    const columns = line.trim().split(/\s+/)
    if (columns.length < 5) continue
    const localAddress = columns[1] ?? ''
    if (!/:8787$/.test(localAddress)) continue
    const pid = Number(columns.at(-1))
    if (Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

function parentIfLumiaBridge(bridgePid) {
  if (process.platform !== 'win32') return 0

  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$bridge=Get-CimInstance Win32_Process -Filter "ProcessId=${bridgePid}"`,
    "if (-not $bridge) { exit 0 }",
    "$parent=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $bridge.ParentProcessId)",
    "if (-not $parent -or -not $parent.CommandLine) { exit 0 }",
    "if ($parent.CommandLine -like '*scripts/start.mjs*' -and $parent.CommandLine -like '*--lumia*') { [Console]::Write($parent.ProcessId) }",
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

  if (result.status !== 0) return 0
  const pid = Number(String(result.stdout ?? '').trim())
  return Number.isInteger(pid) && pid > 0 ? pid : 0
}

const killed = new Set()
const pid = recordedPid()

if (pid && killTree(pid)) {
  killed.add(pid)
}

// A stale PID file can survive an older crash/launcher build. In that case,
// anchor discovery to the bridge that actually owns L.U.M.I.A.'s local port,
// verify its parent command is start.mjs --lumia, then kill only that tree.
for (const bridgePid of bridgeListenerPids()) {
  const parentPid = parentIfLumiaBridge(bridgePid)
  if (!parentPid || killed.has(parentPid)) continue
  if (killTree(parentPid)) killed.add(parentPid)
}

try {
  rmSync(pidFile, { force: true })
} catch {
  // best effort
}
