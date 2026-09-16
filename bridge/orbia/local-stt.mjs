/**
 * C1-E2 local Whisper.cpp adapter.
 *
 * WAV in -> bounded local whisper-cli process -> plain transcript out.
 * No shell, no network, no persistent audio retention.
 */

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { localVoicePaths, probeLocalVoiceCapabilities } from './local-voice-probe.mjs'
import {
  normalizeTechnicalSpeechText,
  ORBI_SPEECH_INITIAL_PROMPT,
} from './speech-vocabulary.mjs'
import { transcribeWithWhisperServer } from './whisper-server-runtime.mjs'

const runFile = promisify(execFile)

export const MAX_LOCAL_STT_BYTES = 25 * 1024 * 1024
export const MAX_LOCAL_TRANSCRIPTION_CHARS = 12_000
export const LOCAL_STT_TIMEOUT_MS = 30_000

export class LocalSpeechToTextError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LocalSpeechToTextError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new LocalSpeechToTextError(code, message)
}

export function isPcmWav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44) return false
  const four = (offset) =>
    String.fromCharCode(...bytes.slice(offset, offset + 4))
  return four(0) === 'RIFF' && four(8) === 'WAVE'
}

export async function transcribeLocalWav(
  audio,
  {
    env = process.env,
    timeoutMs = LOCAL_STT_TIMEOUT_MS,
    initialPrompt = ORBI_SPEECH_INITIAL_PROMPT,
  } = {},
) {
  const bytes =
    audio instanceof Uint8Array
      ? audio
      : Buffer.isBuffer(audio)
        ? new Uint8Array(audio)
        : null

  if (!bytes || bytes.byteLength <= 44 || bytes.byteLength > MAX_LOCAL_STT_BYTES) {
    fail('VOICE_STT_INVALID_AUDIO', 'Voice audio is invalid or exceeds the allowed size.')
  }
  if (!isPcmWav(bytes)) {
    fail('VOICE_STT_UNSUPPORTED_FORMAT', 'Local Whisper currently requires PCM WAV audio.')
  }

  const readiness = probeLocalVoiceCapabilities({ env })
  if (!readiness.stt.localAvailable) {
    fail('VOICE_STT_UNAVAILABLE', 'Local Whisper runtime or model is unavailable.')
  }

  const persistent = await transcribeWithWhisperServer(bytes, {
    env,
    timeoutMs,
    initialPrompt,
  }).catch(() => null)

  if (persistent?.text) {
    const text = normalizeTechnicalSpeechText(persistent.text)
    if (!text) {
      fail('VOICE_STT_EMPTY_RESULT', 'Local Whisper produced an empty transcription.')
    }
    if (text.length > MAX_LOCAL_TRANSCRIPTION_CHARS) {
      fail('VOICE_STT_FAILED', 'Local Whisper transcription exceeds the allowed size.')
    }

    return Object.freeze({
      text,
      language: 'es',
      provider: persistent.provider,
      latencyMs: persistent.latencyMs,
    })
  }

  const { whisperCommand, whisperModel } = localVoicePaths(env)
  const directory = await mkdtemp(join(tmpdir(), 'orbia-stt-'))
  const audioPath = join(directory, 'input.wav')
  const outputPrefix = join(directory, 'transcription')

  try {
    await writeFile(audioPath, bytes)

    try {
      await runFile(
        whisperCommand,
        [
          '-m',
          whisperModel,
          '-f',
          audioPath,
          '-l',
          'es',
          '--prompt',
          initialPrompt,
          '-nt',
          '-otxt',
          '-of',
          outputPrefix,
        ],
        {
          timeout: Math.max(5_000, Number(timeoutMs) || LOCAL_STT_TIMEOUT_MS),
          maxBuffer: 64 * 1024,
          windowsHide: true,
        },
      )
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : ''
      if (code === 'ENOENT') {
        fail('VOICE_STT_UNAVAILABLE', 'Local Whisper executable is unavailable.')
      }
      if (code === 'ETIMEDOUT') {
        fail('VOICE_STT_TIMEOUT', 'Local Whisper transcription timed out.')
      }
      fail('VOICE_STT_FAILED', 'Local Whisper transcription failed.')
    }

    const text = normalizeTechnicalSpeechText(
      String(
        await readFile(`${outputPrefix}.txt`, 'utf8').catch(() =>
          fail('VOICE_STT_FAILED', 'Local Whisper transcription output was unavailable.'),
        ),
      )
        .replace(/\s+/g, ' ')
        .trim(),
    )

    if (!text) {
      fail('VOICE_STT_EMPTY_RESULT', 'Local Whisper produced an empty transcription.')
    }
    if (text.length > MAX_LOCAL_TRANSCRIPTION_CHARS) {
      fail('VOICE_STT_FAILED', 'Local Whisper transcription exceeds the allowed size.')
    }

    return Object.freeze({
      text,
      language: 'es',
      provider: 'whisper-cli-local',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
