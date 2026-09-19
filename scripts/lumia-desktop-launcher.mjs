import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const runtimeDir = resolve(root, '.local-runtime')
const pidFile = resolve(runtimeDir, 'lumia-desktop.pid.json')
const launcherLog = resolve(runtimeDir, 'lumia-launcher.log')
const runtimeLog = resolve(runtimeDir, 'lumia-desktop-runtime.log')
const branch = 'feature/orbia-lumia-convergence-foundation'

mkdirSync(runtimeDir, { recursive: true })

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  appendFileSync(launcherLog, line)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 20_000,
    env: { ...process.env, ...(options.env ?? {}) },
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  }
}

async function fetchOk(url, timeoutMs = 900) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

async function bridgeReady() {
  return fetchOk('http://127.0.0.1:8787/health', 700)
}

async function findFace() {
  for (let port = 5173; port <= 5199; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(450),
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()
      if (/L\.U\.M\.I\.A\.|orbia-lumia-companion/i.test(html)) {
        return `http://localhost:${port}`
      }
    } catch {
      // try next dev port
    }
  }
  return null
}

function openBrowser(url) {
  // explorer.exe delegates HTTP(S) URLs to the user's default browser and
  // avoids the fragile cmd.exe "start" quoting rules on Windows.
  const child = spawn('explorer.exe', [url], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  })
  child.unref()
}

function readPid() {
  try {
    return JSON.parse(readFileSync(pidFile, 'utf8'))
  } catch {
    return null
  }
}

function stopRecordedRuntime() {
  const info = readPid()
  const pid = Number(info?.pid)
  if (!Number.isInteger(pid) || pid <= 0) return false

  const result = run(
    'taskkill.exe',
    ['/PID', String(pid), '/T', '/F'],
    { timeout: 10_000 },
  )
  try {
    rmSync(pidFile, { force: true })
  } catch {
    // best effort
  }
  log(`stopped previous runtime pid=${pid} status=${result.status}`)
  return result.ok
}

async function waitFor(condition, timeoutMs, intervalMs = 350) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return true
    await new Promise((resolvePromise) => setTimeout(resolvePromise, intervalMs))
  }
  return false
}

function gitHead(ref = 'HEAD') {
  const result = run('git.exe', ['rev-parse', ref], { timeout: 8000 })
  return result.ok ? result.stdout : ''
}

function workingTreeClean() {
  const result = run('git.exe', ['status', '--porcelain'], { timeout: 8000 })
  return result.ok && result.stdout === ''
}

function ensureLatestCode() {
  const branchResult = run('git.exe', ['branch', '--show-current'], {
    timeout: 8000,
  })
  if (!branchResult.ok || branchResult.stdout !== branch) {
    log(
      `update skipped: current branch="${branchResult.stdout || 'unknown'}", expected="${branch}"`,
    )
    return { updated: false, dependencyChange: false }
  }

  const before = gitHead()
  const fetch = run('git.exe', ['fetch', 'origin', branch], { timeout: 25_000 })
  if (!fetch.ok) {
    log(`offline/update fetch skipped: ${fetch.stderr || fetch.stdout || 'fetch failed'}`)
    return { updated: false, dependencyChange: false }
  }

  const remote = gitHead(`origin/${branch}`)
  if (!remote || remote === before) {
    log('repository already current')
    return { updated: false, dependencyChange: false }
  }

  if (!workingTreeClean()) {
    log('new remote version exists, but local changes are present; update skipped safely')
    return { updated: false, dependencyChange: false }
  }

  const dependencyProbe = run(
    'git.exe',
    ['diff', '--name-only', before, remote, '--', 'package.json', 'package-lock.json'],
    { timeout: 8000 },
  )
  const dependencyChange =
    dependencyProbe.ok && Boolean(dependencyProbe.stdout.trim())

  const pull = run(
    'git.exe',
    ['pull', '--ff-only', 'origin', branch],
    { timeout: 30_000 },
  )
  if (!pull.ok) {
    log(`update failed safely: ${pull.stderr || pull.stdout || 'git pull failed'}`)
    return { updated: false, dependencyChange: false }
  }

  log(`updated repository ${before.slice(0, 8)} -> ${gitHead().slice(0, 8)}`)
  return { updated: true, dependencyChange }
}

function ensureDependencies() {
  const result = run(
    'npm.cmd',
    ['install', '--no-audit', '--no-fund'],
    { timeout: 180_000 },
  )
  log(
    result.ok
      ? 'dependencies synchronized after update'
      : `dependency sync failed: ${result.stderr || result.stdout}`,
  )
  return result.ok
}

async function ollamaReady() {
  return fetchOk('http://127.0.0.1:11434/api/tags', 800)
}

async function ensureOllama() {
  if (await ollamaReady()) {
    log('Ollama already ready')
    return true
  }

  const local = process.env.LOCALAPPDATA ?? ''
  const candidates = [
    resolve(local, 'Programs', 'Ollama', 'ollama app.exe'),
    resolve(local, 'Programs', 'Ollama', 'Ollama.exe'),
  ]

  const executable = candidates.find((candidate) => existsSync(candidate))
  if (!executable) {
    log('Ollama app executable not found; continuing so L.U.M.I.A. can surface the error')
    return false
  }

  const child = spawn(executable, [], {
    cwd: dirname(executable),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  })
  child.unref()
  log(`started Ollama app: ${executable}`)

  const ready = await waitFor(ollamaReady, 15_000, 500)
  log(ready ? 'Ollama became ready' : 'Ollama did not become ready within 15s')
  return ready
}

function startLumia() {
  const fd = openSync(runtimeLog, 'a')
  const child = spawn(
    process.execPath,
    ['scripts/start.mjs', '--lumia'],
    {
      cwd: root,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      env: {
        ...process.env,
        ORBIA_WHISPER_SERVER_ENABLED:
          process.env.ORBIA_WHISPER_SERVER_ENABLED ?? '0',
      },
    },
  )
  closeSync(fd)
  writeFileSync(
    pidFile,
    JSON.stringify(
      {
        pid: child.pid,
        startedAt: new Date().toISOString(),
        branch,
      },
      null,
      2,
    ),
  )
  child.unref()
  log(`started L.U.M.I.A. runtime pid=${child.pid}`)
}

async function main() {
  log('launcher invoked')

  const wasRunning = await bridgeReady()
  const beforeFace = wasRunning ? await findFace() : null

  const update = ensureLatestCode()

  if (update.updated && wasRunning) {
    stopRecordedRuntime()
    await waitFor(async () => !(await bridgeReady()), 5000, 250)
  }

  if (update.updated && update.dependencyChange) {
    ensureDependencies()
  }

  if (!update.updated && wasRunning && beforeFace) {
    openBrowser(beforeFace)
    log(`existing runtime opened at ${beforeFace}`)
    return
  }

  await ensureOllama()

  if (!(await bridgeReady())) {
    startLumia()
  }

  const bridge = await waitFor(bridgeReady, 30_000, 350)
  const face = await (async () => {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const url = await findFace()
      if (url) return url
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 350))
    }
    return null
  })()

  if (face) {
    openBrowser(face)
    log(
      bridge
        ? `L.U.M.I.A. opened at ${face}`
        : `L.U.M.I.A. interface opened at ${face}, but bridge is not ready; see ${runtimeLog}`,
    )
    return
  }

  log(
    `startup incomplete: bridge=${bridge ? 'ready' : 'missing'} face=missing; see ${runtimeLog}`,
  )
}

main().catch((error) => {
  log(`launcher fatal: ${error?.stack ?? error}`)
})
