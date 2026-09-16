/**
 * C1-E1 local voice capability probe.
 *
 * Detects local Whisper.cpp and Kokoro runtime assets without starting them.
 * This is intentionally side-effect free so boot can report readiness before
 * the active browser voice path is changed.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const firstExisting = (candidates, exists = existsSync) =>
  candidates.find((candidate) => candidate && exists(candidate)) ?? null

export function localVoicePaths(
  env = process.env,
  exists = existsSync,
) {
  const whisperCommand =
    env.ORBI_LOCAL_STT_COMMAND?.trim() ||
    firstExisting(
      [
        resolve(root, '.local-runtime', 'whisper.cpp', 'bin', 'Release', 'whisper-cli.exe'),
        resolve(root, '.local-runtime', 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-cli.exe'),
        resolve(root, '.local-runtime', 'whisper.cpp', 'main.exe'),
      ],
      exists,
    ) ||
    resolve(root, '.local-runtime', 'whisper.cpp', 'bin', 'Release', 'whisper-cli.exe')

  const whisperModel =
    env.ORBI_LOCAL_STT_MODEL?.trim() ||
    firstExisting(
      [
        resolve(root, '.local-runtime', 'whisper.cpp', 'models', 'ggml-base.bin'),
        resolve(root, '.local-runtime', 'whisper.cpp', 'models', 'ggml-small.bin'),
        resolve(root, '.local-runtime', 'whisper.cpp', 'models', 'ggml-base.en.bin'),
      ],
      exists,
    ) ||
    resolve(root, '.local-runtime', 'whisper.cpp', 'models', 'ggml-base.bin')

  const kokoroPython =
    env.ORBI_LOCAL_TTS_PYTHON?.trim() ||
    resolve(root, '.local-runtime', 'kokoro', '.venv', 'Scripts', 'python.exe')
  const kokoroScript =
    env.ORBI_LOCAL_TTS_SCRIPT?.trim() ||
    resolve(root, 'bridge', 'runtime', 'kokoro', 'synthesize.py')
  const kokoroModel =
    env.ORBI_LOCAL_TTS_MODEL?.trim() ||
    resolve(root, '.local-runtime', 'kokoro', 'models', 'kokoro-v1.0.onnx')
  const kokoroVoices =
    env.ORBI_LOCAL_TTS_VOICES?.trim() ||
    resolve(root, '.local-runtime', 'kokoro', 'models', 'voices-v1.0.bin')

  return Object.freeze({
    whisperCommand,
    whisperModel,
    kokoroPython,
    kokoroScript,
    kokoroModel,
    kokoroVoices,
  })
}

export function probeLocalVoiceCapabilities({
  env = process.env,
  exists = existsSync,
} = {}) {
  const paths = localVoicePaths(env, exists)

  const whisper = Object.freeze({
    provider: 'whisper-cpp-local',
    commandReady: exists(paths.whisperCommand),
    modelReady: exists(paths.whisperModel),
    command: paths.whisperCommand,
    model: paths.whisperModel,
  })

  const kokoro = Object.freeze({
    provider: 'kokoro-local',
    pythonReady: exists(paths.kokoroPython),
    scriptReady: exists(paths.kokoroScript),
    modelReady: exists(paths.kokoroModel),
    voicesReady: exists(paths.kokoroVoices),
    python: paths.kokoroPython,
    script: paths.kokoroScript,
    model: paths.kokoroModel,
    voices: paths.kokoroVoices,
  })

  return Object.freeze({
    stt: Object.freeze({
      localAvailable: whisper.commandReady && whisper.modelReady,
      whisper,
    }),
    tts: Object.freeze({
      localAvailable:
        kokoro.pythonReady &&
        kokoro.scriptReady &&
        kokoro.modelReady &&
        kokoro.voicesReady,
      kokoro,
    }),
  })
}
