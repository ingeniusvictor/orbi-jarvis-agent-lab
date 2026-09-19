/**
 * Windows-local secret store for L.U.M.I.A. cloud providers.
 *
 * API keys are never written as plaintext. On Windows, PowerShell's
 * ConvertFrom-SecureString uses DPAPI when no explicit key is supplied, binding
 * the ciphertext to the current Windows user. Environment variables remain a
 * supported override for CI and advanced users.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
export const OPENAI_DPAPI_SECRET_PATH = resolve(
  root,
  '.local-runtime',
  'secrets',
  'openai-api-key.dpapi',
)

let cachedOpenAIKey = ''

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function decryptDpapiSecret(path) {
  if (process.platform !== 'win32' || !existsSync(path)) return ''

  const script = [
    "$ErrorActionPreference='Stop'",
    `$cipher=Get-Content -LiteralPath ${psLiteral(path)} -Raw`,
    '$secure=ConvertTo-SecureString $cipher',
    '$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
    'try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }',
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

  if (result.status !== 0) return ''
  return String(result.stdout ?? '').trim()
}

export function resolveOpenAIKey(env = process.env) {
  const fromEnvironment = env.OPENAI_API_KEY?.trim()
  if (fromEnvironment) return fromEnvironment

  if (env !== process.env) return ''

  if (cachedOpenAIKey) return cachedOpenAIKey
  const decrypted = decryptDpapiSecret(OPENAI_DPAPI_SECRET_PATH)
  if (decrypted) cachedOpenAIKey = decrypted
  return decrypted
}

export function openAIKeySource(env = process.env) {
  if (env.OPENAI_API_KEY?.trim()) return 'environment'
  if (
    env === process.env &&
    process.platform === 'win32' &&
    existsSync(OPENAI_DPAPI_SECRET_PATH)
  ) {
    return resolveOpenAIKey(env) ? 'windows-dpapi' : 'dpapi-unreadable'
  }
  return 'missing'
}

export function clearOpenAIKeyCache() {
  cachedOpenAIKey = ''
}
