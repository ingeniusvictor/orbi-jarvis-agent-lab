/**
 * Per-user non-secret brain settings for L.U.M.I.A.
 *
 * Stored under .local-runtime so every installation can choose local/cloud/
 * hybrid independently without changing tracked source files. Secrets are never
 * stored here; API keys belong to secure-secrets.mjs.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()

export const BRAIN_SETTINGS_PATH = resolve(
  root,
  '.local-runtime',
  'brain-settings.json',
)

const ALLOWED_PROVIDERS = new Set([
  'ollama',
  'openai',
  'hybrid',
  'claude',
])

const DEFAULT_SETTINGS = Object.freeze({
  provider: null,
  cloudHistory: true,
})

function normalizeProvider(value) {
  const provider = String(value ?? '').trim().toLowerCase()
  return ALLOWED_PROVIDERS.has(provider) ? provider : null
}

export function readBrainSettings() {
  if (!existsSync(BRAIN_SETTINGS_PATH)) {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const parsed = JSON.parse(
      readFileSync(BRAIN_SETTINGS_PATH, 'utf8'),
    )
    return {
      provider: normalizeProvider(parsed?.provider),
      cloudHistory: parsed?.cloudHistory !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeBrainSettings({
  provider,
  cloudHistory = true,
}) {
  const normalized = normalizeProvider(provider)
  if (!normalized) {
    throw new Error(
      'Brain provider must be ollama, openai, hybrid or claude.',
    )
  }

  const next = {
    provider: normalized,
    cloudHistory: Boolean(cloudHistory),
  }

  mkdirSync(dirname(BRAIN_SETTINGS_PATH), { recursive: true })
  writeFileSync(
    BRAIN_SETTINGS_PATH,
    JSON.stringify(next, null, 2) + '\n',
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  )

  return Object.freeze({ ...next })
}
