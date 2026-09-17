/**
 * Persistent whisper.cpp server for low-latency local STT.
 *
 * Experimental/opt-in. It keeps the model resident but must not own a global
 * recognition prompt: wake/guard audio and command audio need different bias.
 */

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { localVoicePaths } from './local-voice-probe.mjs'
import { ORBI_SPEECH_INITIAL_PROMPT } from './speech-vocabulary.mjs'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8179
const START_TIMEOUT_MS = 20_000
const REQUEST_TIMEOUT_MS = 20_000

let child = null
let startPromise = null
let shutdownHookInstalled = false

const runtimeConfig = (env = process.env) => {
  const paths = localVoicePaths(env)
  const host = env.ORBI_WHISPER_SERVER_HOST?.trim() || DEFAULT_HOST
  const port = Math.max(
    1024,
    Math.min(65535, Number(env.ORBI_WHISPER_SERVER_PORT) || DEFAULT_PORT),
  )

  return Object.freeze({
    command: paths.whisperServerCommand,
    model: paths.whisperModel,
    host,
    port,
    baseUrl: `http://${host}:${port}`,
  })
}

async function health(baseUrl, timeoutMs = 900) {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return false
    const json = await res.json().catch(() => null)
    return json?.status === 'ok'
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

function stopChild() {
  if (!child) return
  try {
    child.kill()
  } catch {
    // Best effort during process teardown.
  }
  child = null
}

function installShutdownHook() {
  if (shutdownHookInstalled) return
  shutdownHookInstalled = true

  process.once('exit', stopChild)
  process.once('SIGINT', () => {
    stopChild()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    stopChild()
    process.exit(143)
  })
}

export function whisperServerPaths(env = process.env) {
  const config = runtimeConfig(env)
  return Object.freeze({
    command: config.command,
    model: config.model,
    baseUrl: config.baseUrl,
  })
}

export async function ensureWhisperServer({
  env = process.env,
  timeoutMs = START_TIMEOUT_MS,
} = {}) {
  const config = runtimeConfig(env)

  if (!existsSync(config.command) || !existsSync(config.model)) {
    return Object.freeze({
      ready: false,
      reason: 'missing-runtime',
      ...config,
    })
  }

  if (await health(config.baseUrl)) {
    return Object.freeze({
      ready: true,
      reused: true,
      ...config,
    })
  }

  if (startPromise) return startPromise

  startPromise = (async () => {
    installShutdownHook()

    const args = [
      '-m',
      config.model,
      '-l',
      'es',
      '--host',
      config.host,
      '--port',
      String(config.port),
      '-nt',
      '-sns',
      '-nc',
    ]

    const threads = Number(env.ORBI_WHISPER_THREADS)
    if (Number.isFinite(threads) && threads >= 1 && threads <= 32) {
      args.unshift(String(Math.round(threads)))
      args.unshift('-t')
    }

    child = spawn(config.command, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderrTail = ''
    child.stderr.on('data', (chunk) => {
      stderrTail = (stderrTail + String(chunk)).slice(-4000)
    })

    child.once('exit', () => {
      child = null
    })

    child.once('error', () => {
      child = null
    })

    const deadline = Date.now() + Math.max(3000, Number(timeoutMs) || START_TIMEOUT_MS)
    while (Date.now() < deadline) {
      if (await health(config.baseUrl, 700)) {
        return Object.freeze({
          ready: true,
          reused: false,
          ...config,
        })
      }
      if (!child) break
      await sleep(180)
    }

    stopChild()

    return Object.freeze({
      ready: false,
      reason: stderrTail ? 'startup-failed' : 'startup-timeout',
      detail: stderrTail.slice(-600),
      ...config,
    })
  })().finally(() => {
    startPromise = null
  })

  return startPromise
}

export async function transcribeWithWhisperServer(
  audio,
  {
    env = process.env,
    timeoutMs = REQUEST_TIMEOUT_MS,
    initialPrompt = ORBI_SPEECH_INITIAL_PROMPT,
  } = {},
) {
  const ready = await ensureWhisperServer({ env })
  if (!ready.ready) return null

  const bytes =
    audio instanceof Uint8Array
      ? audio
      : Buffer.isBuffer(audio)
        ? new Uint8Array(audio)
        : null

  if (!bytes?.byteLength) return null

  const form = new FormData()
  form.append(
    'file',
    new Blob([bytes], { type: 'audio/wav' }),
    'speech.wav',
  )
  form.append('response_format', 'json')
  form.append('language', 'es')
  form.append('temperature', '0.0')
  if (String(initialPrompt ?? '').trim()) {
    form.append('prompt', String(initialPrompt).trim())
  }
  form.append('no_context', 'true')
  form.append('suppress_nst', 'true')

  const started = performance.now()
  const res = await fetch(`${ready.baseUrl}/inference`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(
      Math.max(5000, Number(timeoutMs) || REQUEST_TIMEOUT_MS),
    ),
  })

  if (!res.ok) {
    throw new Error(`whisper-server HTTP ${res.status}`)
  }

  const json = await res.json()
  const text = String(json?.text ?? '').replace(/\s+/g, ' ').trim()

  return Object.freeze({
    text,
    latencyMs: Math.round(performance.now() - started),
    provider: 'whisper-server-local',
  })
}

export async function probeWhisperServerRuntime(env = process.env) {
  const config = runtimeConfig(env)
  return Object.freeze({
    commandReady: existsSync(config.command),
    modelReady: existsSync(config.model),
    running: await health(config.baseUrl),
    baseUrl: config.baseUrl,
    command: config.command,
  })
}
