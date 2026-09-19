import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const pidFile = resolve(root, '.local-runtime', 'lumia-desktop.pid.json')

if (!existsSync(pidFile)) process.exit(0)

let pid = 0
try {
  pid = Number(JSON.parse(readFileSync(pidFile, 'utf8'))?.pid)
} catch {
  pid = 0
}

if (Number.isInteger(pid) && pid > 0) {
  spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
  })
}

try {
  rmSync(pidFile, { force: true })
} catch {
  // best effort
}
