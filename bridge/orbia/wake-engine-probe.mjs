/**
 * Dedicated wake-engine readiness.
 *
 * Canonical target: openWakeWord with an ORBI-owned Lumi ONNX model.
 * Porcupine remains an optional adapter but is never auto-selected because its
 * Web SDK requires an AccessKey in the browser runtime.
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const root = process.cwd()

export function wakeEnginePaths(env = process.env) {
  return Object.freeze({
    openWakeWordPython:
      env.ORBIA_OPENWAKEWORD_PYTHON?.trim() ||
      resolve(
        root,
        '.local-runtime',
        'wake',
        'openwakeword',
        '.venv',
        'Scripts',
        'python.exe',
      ),
    lumiOnnx:
      env.ORBIA_WAKE_MODEL?.trim() ||
      resolve(root, '.local-runtime', 'wake', 'models', 'lumi.onnx'),
    porcupineKeyword:
      env.ORBIA_PORCUPINE_KEYWORD?.trim() ||
      resolve(root, '.local-runtime', 'wake', 'porcupine', 'lumi.ppn'),
  })
}

export function probeWakeEngine({
  env = process.env,
  exists = existsSync,
} = {}) {
  const paths = wakeEnginePaths(env)

  let porcupinePackageReady = false
  try {
    require.resolve('@picovoice/porcupine-web')
    porcupinePackageReady = true
  } catch {
    porcupinePackageReady = false
  }

  const openWakeWord = Object.freeze({
    runtimeReady: exists(paths.openWakeWordPython),
    modelReady: exists(paths.lumiOnnx),
    ready:
      exists(paths.openWakeWordPython) &&
      exists(paths.lumiOnnx),
  })

  const porcupine = Object.freeze({
    packageReady: porcupinePackageReady,
    keywordReady: exists(paths.porcupineKeyword),
    accessKeyConfigured: Boolean(
      env.ORBIA_PICOVOICE_ACCESS_KEY?.trim(),
    ),
    ready:
      porcupinePackageReady &&
      exists(paths.porcupineKeyword) &&
      Boolean(env.ORBIA_PICOVOICE_ACCESS_KEY?.trim()),
    autoSelectable: false,
  })

  const requested = String(env.ORBIA_WAKE_ENGINE ?? 'auto')
    .trim()
    .toLowerCase()

  let selected = 'transcript'
  if (
    (requested === 'auto' || requested === 'openwakeword') &&
    openWakeWord.ready
  ) {
    selected = 'openwakeword'
  } else if (requested === 'porcupine' && porcupine.ready) {
    selected = 'porcupine'
  }

  return Object.freeze({
    canonical: 'openwakeword',
    requested,
    selected,
    dedicatedReady: selected !== 'transcript',
    transcriptFallback: true,
    openWakeWord,
    porcupine,
    paths,
  })
}
