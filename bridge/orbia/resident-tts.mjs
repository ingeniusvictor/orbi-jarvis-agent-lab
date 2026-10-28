/**
 * VA-01: optional owner-gated Kokoro resident worker.
 *
 * Keeps ONNX + Spanish phonemizer warm across phrases. Uses the same local
 * Python venv/model files as the one-shot adapter. A single bounded FIFO
 * serializes requests so overlapping audio chunks never race one ONNX session.
 * Crashes or timeouts release the worker and allow the legacy path to recover.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { localVoicePaths } from './local-voice-probe.mjs'

const START_TIMEOUT_MS = 30000
const MAX_PENDING_BYTES = 64 * 1024
const MAX_AUDIO_BYTES = 15 * 1024 * 1024

let resident = null
let starting = null
let fifo = Promise.resolve()
let nextId = 0

function failResident(state, error) {
  if (state.dead) return
  state.dead = true
  if (state.startTimer) clearTimeout(state.startTimer)
  if (state.current?.timer) clearTimeout(state.current.timer)
  state.current?.reject(error)
  state.current = null
  state.rejectStart(error)
  if (resident === state) resident = null
  if (starting === state.startPromise) starting = null
  try { state.child.kill() } catch { /* gone */ }
}

function startResident(env = process.env) {
  if (resident?.ready && !resident.dead) return Promise.resolve(resident)
  if (starting) return starting

  const paths = localVoicePaths(env)
  // Always invoke this branch's resident adapter, even when the one-shot
  // adapter lives in the original Windows checkout.
  const script = resolve(process.cwd(), 'bridge', 'runtime', 'kokoro', 'resident.py')
  const child = spawn(paths.kokoroPython, [script], {
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...env,
      ORBI_LOCAL_TTS_MODEL: paths.kokoroModel,
      ORBI_LOCAL_TTS_VOICES: paths.kokoroVoices,
    },
  })
  const state = {
    child, dead: false, ready: false, buffer: '', current: null,
    resolveStart: () => {}, rejectStart: () => {}, startTimer: null,
    startPromise: null,
  }
  resident = state
  const ready = new Promise((resolveReady, rejectReady) => {
    state.resolveStart = () => resolveReady(state)
    state.rejectStart = rejectReady
  })
  state.startPromise = ready
  starting = ready
  state.startTimer = setTimeout(
    () => failResident(state, new Error('Kokoro resident startup timed out')),
    START_TIMEOUT_MS,
  )

  child.stderr.resume() // avoid stderr pipe backpressure; avoid speech in logs
  child.on('error', (e) => failResident(state, e))
  child.on('exit', (code) => {
    failResident(state, new Error(`Kokoro resident stopped (code ${code})`))
  })

  child.stdout.on('data', (chunk) => {
    if (state.dead) return
    state.buffer += String(chunk)
    if (state.buffer.length > MAX_PENDING_BYTES) {
      failResident(state, new Error('Kokoro resident output too large'))
      return
    }
    for (;;) {
      const at = state.buffer.indexOf('\n')
      if (at < 0) break
      const line = state.buffer.slice(0, at).trim()
      state.buffer = state.buffer.slice(at + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch {
        failResident(state, new Error('Kokoro resident protocol error'))
        return
      }

      if (!state.ready) {
        if (msg.ready !== true) {
          failResident(state, new Error('Kokoro resident initialization failed'))
          return
        }
        state.ready = true
        clearTimeout(state.startTimer)
        state.startTimer = null
        starting = null
        state.resolveStart()
        continue
      }

      const job = state.current
      if (!job || msg.id !== job.id) {
        failResident(state, new Error('Kokoro resident unexpected response'))
        return
      }
      clearTimeout(job.timer)
      state.current = null
      if (msg.ok === true) job.resolve()
      else job.reject(new Error(String(msg.errorCode || 'VOICE_TTS_FAILED')))
    }
  })
  return ready
}

/** Called at bridge boot only when the owner explicitly enables resident TTS. */
export async function prewarmResidentKokoro(env = process.env) {
  if (env.ORBIA_KOKORO_RESIDENT_ENABLED !== '1') {
    return { enabled: false }
  }
  try {
    await startResident(env)
    return { enabled: true, ready: true }
  } catch (err) {
    return { enabled: true, ready: false, reason: String(err?.message || err) }
  }
}

function dispatch(state, payload, timeoutMs) {
  if (state.dead || !state.ready) return Promise.reject(new Error('Worker is not ready'))
  if (state.current) return Promise.reject(new Error('Kokoro worker already busy'))
  return new Promise((resolveJob, rejectJob) => {
    const id = ++nextId
    const timer = setTimeout(
      () => failResident(state, new Error('Kokoro resident synthesis timeout')),
      Math.max(5000, timeoutMs),
    )
    state.current = { id, resolve: resolveJob, reject: rejectJob, timer }
    state.child.stdin.write(JSON.stringify({ id, ...payload }) + '\n', (err) => {
      if (err) failResident(state, err)
    })
  })
}

export function synthesizeResidentKokoro(
  text,
  { speaker = 'ef_dora', timeoutMs = 30000, env = process.env } = {},
) {
  // Serialize all phrase syntheses; the previous item finishes and releases
  // its temporary file before the next uses the shared Kokoro ONNX object.
  const task = fifo.then(async () => {
    const state = await startResident(env)
    const directory = await mkdtemp(join(tmpdir(), 'orbia-kokoro-resident-'))
    const outputPath = join(directory, 'speech.wav')
    try {
      await dispatch(state, { text, outputPath, speaker }, timeoutMs)
      const bytes = new Uint8Array(await readFile(outputPath))
      if (bytes.byteLength <= 44 || bytes.byteLength > MAX_AUDIO_BYTES ||
          Buffer.from(bytes.subarray(0, 4)).toString('ascii') !== 'RIFF' ||
          Buffer.from(bytes.subarray(8, 12)).toString('ascii') !== 'WAVE') {
        throw new Error('Kokoro resident returned invalid WAV output')
      }
      return bytes
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  fifo = task.then(() => {}, () => {})
  return task
}

process.once('exit', () => {
  if (resident && !resident.dead) {
    try { resident.child.kill() } catch { /* no running worker */ }
  }
})
