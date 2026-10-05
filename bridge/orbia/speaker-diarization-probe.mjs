/**
 * Speaker diarization capability probe.
 *
 * This does not identify people and does not perform diarization. It reports
 * whether the local sherpa-onnx runtime can actually be loaded and whether the
 * required model assets are installed, so the multivoice UI remains truthful.
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const projectRequire = createRequire(import.meta.url)
const root = process.cwd()

export function speakerDiarizationPaths(env = process.env) {
  return Object.freeze({
    segmentationModel:
      env.ORBIA_DIARIZATION_SEGMENTATION_MODEL?.trim() ||
      resolve(
        root,
        '.local-runtime',
        'diarization',
        'segmentation',
        'model.onnx',
      ),
    embeddingModel:
      env.ORBIA_DIARIZATION_EMBEDDING_MODEL?.trim() ||
      resolve(
        root,
        '.local-runtime',
        'diarization',
        'embedding',
        'speaker-embedding.onnx',
      ),
    runtimePackageJson:
      env.ORBIA_DIARIZATION_RUNTIME_PACKAGE?.trim() ||
      resolve(
        root,
        '.local-runtime',
        'diarization',
        'node-runtime',
        'package.json',
      ),
  })
}

export function sherpaRuntimeRequire(env = process.env) {
  const { runtimePackageJson } = speakerDiarizationPaths(env)
  const isolatedRequire = createRequire(runtimePackageJson)

  try {
    isolatedRequire.resolve('sherpa-onnx-node')
    return isolatedRequire
  } catch {
    // Compatibility with machines that installed the first experimental build
    // in the project root. New installs live under .local-runtime/diarization.
  }

  try {
    projectRequire.resolve('sherpa-onnx-node')
    return projectRequire
  } catch {
    return null
  }
}

function probeRuntimeLoad(runtimeRequire) {
  if (!runtimeRequire) {
    return Object.freeze({
      ready: false,
      error: 'sherpa-onnx-node package is not installed.',
    })
  }

  try {
    const sherpa = runtimeRequire('sherpa-onnx-node')
    if (typeof sherpa?.OfflineSpeakerDiarization !== 'function') {
      return Object.freeze({
        ready: false,
        error: 'sherpa-onnx-node loaded without OfflineSpeakerDiarization.',
      })
    }
    return Object.freeze({ ready: true, error: null })
  } catch (error) {
    return Object.freeze({
      ready: false,
      error: String(error?.message ?? error).split('\n')[0].slice(0, 240),
    })
  }
}

export function probeSpeakerDiarization({
  env = process.env,
  exists = existsSync,
} = {}) {
  const paths = speakerDiarizationPaths(env)

  const runtimeRequire = sherpaRuntimeRequire(env)
  const packageReady = Boolean(runtimeRequire)
  const runtimeLoad = probeRuntimeLoad(runtimeRequire)

  const segmentationReady = exists(paths.segmentationModel)
  const embeddingReady = exists(paths.embeddingModel)

  return Object.freeze({
    provider: 'sherpa-onnx-local',
    available:
      packageReady &&
      runtimeLoad.ready &&
      segmentationReady &&
      embeddingReady,
    packageReady,
    runtimeLoadReady: runtimeLoad.ready,
    runtimeLoadError: runtimeLoad.error,
    packageLocation:
      runtimeRequire && exists(paths.runtimePackageJson)
        ? 'isolated-runtime'
        : packageReady
          ? 'project-compat'
          : 'missing',
    segmentationReady,
    embeddingReady,
    paths,
  })
}
