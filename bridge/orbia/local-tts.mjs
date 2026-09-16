/**
 * C1-E4 local Kokoro adapter.
 *
 * Text in -> local Python/Kokoro process -> validated PCM WAV bytes out.
 * No shell, no network, no persistent synthesis files.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { localVoicePaths, probeLocalVoiceCapabilities } from './local-voice-probe.mjs'

export const MAX_LOCAL_TTS_CHARS = 4000
export const LOCAL_TTS_TIMEOUT_MS = 30_000

export class LocalTextToSpeechError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LocalTextToSpeechError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new LocalTextToSpeechError(code, message)
}

export function isWave(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44) return false
  const four = (offset) =>
    String.fromCharCode(...bytes.slice(offset, offset + 4))
  return four(0) === 'RIFF' && four(8) === 'WAVE'
}

export async function synthesizeLocalSpeech(
  text,
  {
    env = process.env,
    timeoutMs = LOCAL_TTS_TIMEOUT_MS,
    speaker = 'ef_dora',
  } = {},
) {
  const input = String(text ?? '').trim()
  if (!input || input.length > MAX_LOCAL_TTS_CHARS) {
    fail('VOICE_TTS_INVALID_TEXT', 'Voice synthesis text is invalid or exceeds the allowed size.')
  }

  const readiness = probeLocalVoiceCapabilities({ env })
  if (!readiness.tts.localAvailable) {
    fail('VOICE_TTS_UNAVAILABLE', 'Local Kokoro runtime or model is unavailable.')
  }

  const { kokoroPython, kokoroScript } = localVoicePaths(env)
  const directory = await mkdtemp(join(tmpdir(), 'orbia-kokoro-'))
  const output = join(directory, 'speech.wav')

  try {
    await new Promise((resolvePromise, reject) => {
      const child = spawn(kokoroPython, [kokoroScript], {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(
          new LocalTextToSpeechError(
            'VOICE_TTS_TIMEOUT',
            'Local Kokoro synthesis timed out.',
          ),
        )
      }, Math.max(5_000, Number(timeoutMs) || LOCAL_TTS_TIMEOUT_MS))

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk)
        if (stdout.length > 16_384) stdout = stdout.slice(-16_384)
      })
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk)
        if (stderr.length > 16_384) stderr = stderr.slice(-16_384)
      })

      child.on('error', () => {
        clearTimeout(timer)
        reject(
          new LocalTextToSpeechError(
            'VOICE_TTS_UNAVAILABLE',
            'Local Kokoro runtime is unavailable.',
          ),
        )
      })

      child.on('exit', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolvePromise()
          return
        }

        let errorCode = 'VOICE_TTS_FAILED'
        try {
          const packet = JSON.parse(stdout.trim())
          if (
            typeof packet?.errorCode === 'string' &&
            packet.errorCode.startsWith('VOICE_TTS_')
          ) {
            errorCode = packet.errorCode
          }
        } catch {
          // The bounded stderr is intentionally not surfaced to the browser.
        }

        reject(
          new LocalTextToSpeechError(
            errorCode,
            stderr.trim()
              ? 'Local Kokoro synthesis failed.'
              : 'Local Kokoro synthesis failed.',
          ),
        )
      })

      child.stdin.end(
        JSON.stringify({
          text: input,
          outputPath: output,
          speaker: String(speaker || 'ef_dora'),
        }),
      )
    })

    const bytes = new Uint8Array(
      await readFile(output).catch(() =>
        fail('VOICE_TTS_FAILED', 'Local Kokoro audio output was unavailable.'),
      ),
    )

    if (!isWave(bytes)) {
      fail('VOICE_TTS_FAILED', 'Local Kokoro returned invalid WAV audio.')
    }

    return Object.freeze({
      audio: bytes,
      mimeType: 'audio/wav',
      format: 'wav',
      provider: 'kokoro-local',
      speaker: String(speaker || 'ef_dora'),
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
