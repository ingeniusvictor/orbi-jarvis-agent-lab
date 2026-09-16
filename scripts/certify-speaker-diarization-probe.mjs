import assert from 'node:assert/strict'
import {
  probeSpeakerDiarization,
  speakerDiarizationPaths,
} from '../bridge/orbia/speaker-diarization-probe.mjs'

const env = {
  ORBIA_DIARIZATION_SEGMENTATION_MODEL: 'C:/voice/segmentation.onnx',
  ORBIA_DIARIZATION_EMBEDDING_MODEL: 'C:/voice/embedding.onnx',
}

const paths = speakerDiarizationPaths(env)
assert.equal(paths.segmentationModel, env.ORBIA_DIARIZATION_SEGMENTATION_MODEL)
assert.equal(paths.embeddingModel, env.ORBIA_DIARIZATION_EMBEDDING_MODEL)

const none = probeSpeakerDiarization({
  env,
  exists: () => false,
})
assert.equal(none.available, false)
assert.equal(none.segmentationReady, false)
assert.equal(none.embeddingReady, false)

const modelsOnly = probeSpeakerDiarization({
  env,
  exists: () => true,
})
assert.equal(modelsOnly.segmentationReady, true)
assert.equal(modelsOnly.embeddingReady, true)
// Package readiness is intentionally discovered from the real Node runtime.
assert.equal(
  modelsOnly.available,
  modelsOnly.packageReady &&
    modelsOnly.segmentationReady &&
    modelsOnly.embeddingReady,
)

console.log('Speaker diarization readiness probe: PASS')
console.log('Provider: sherpa-onnx-local')
console.log('Readiness: package + segmentation + embedding required')
