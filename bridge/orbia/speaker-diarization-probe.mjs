/**
 * Speaker diarization capability probe.
 *
 * This does not identify people and does not perform diarization. It only
 * reports whether the planned local sherpa-onnx runtime and model assets are
 * installed so the multivoice UI can remain truthful.
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
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
  })
}

export function probeSpeakerDiarization({
  env = process.env,
  exists = existsSync,
} = {}) {
  const paths = speakerDiarizationPaths(env)

  let packageReady = false
  try {
    require.resolve('sherpa-onnx-node')
    packageReady = true
  } catch {
    packageReady = false
  }

  const segmentationReady = exists(paths.segmentationModel)
  const embeddingReady = exists(paths.embeddingModel)

  return Object.freeze({
    provider: 'sherpa-onnx-local',
    available: packageReady && segmentationReady && embeddingReady,
    packageReady,
    segmentationReady,
    embeddingReady,
    paths,
  })
}
