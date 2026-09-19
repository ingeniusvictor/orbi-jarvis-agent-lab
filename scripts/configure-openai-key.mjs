/**
 * Configure or remove the OpenAI API key using Windows DPAPI.
 *
 * The plaintext key is read by PowerShell as a SecureString and is never
 * written to disk or printed to stdout.
 */

import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  OPENAI_DPAPI_SECRET_PATH,
} from '../bridge/providers/secure-secrets.mjs'

if (process.platform !== 'win32') {
  console.error(
    'DPAPI configuration is currently available on Windows only. Use OPENAI_API_KEY in the process environment on this platform.',
  )
  process.exit(1)
}

if (process.argv.includes('--remove')) {
  rmSync(OPENAI_DPAPI_SECRET_PATH, { force: true })
  console.log('OpenAI API key removed from the local L.U.M.I.A. secret store.')
  process.exit(0)
}

mkdirSync(dirname(OPENAI_DPAPI_SECRET_PATH), { recursive: true })

const escapedPath = OPENAI_DPAPI_SECRET_PATH.replace(/'/g, "''")
const script = [
  "$ErrorActionPreference='Stop'",
  "$secure=Read-Host 'Pega tu OpenAI API key' -AsSecureString",
  "if ($secure.Length -eq 0) { throw 'No se ingreso ninguna API key.' }",
  '$cipher=ConvertFrom-SecureString $secure',
  `Set-Content -LiteralPath '${escapedPath}' -Value $cipher -NoNewline`,
  "Write-Host 'API key cifrada con Windows DPAPI.'",
].join('; ')

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-Command', script],
  {
    stdio: 'inherit',
    windowsHide: false,
  },
)

if (result.status !== 0) {
  console.error('No se pudo guardar la API key.')
  process.exit(result.status ?? 1)
}

console.log('')
console.log('La clave quedó guardada solo para este usuario de Windows.')
console.log('No se añadió al repositorio ni al frontend.')
