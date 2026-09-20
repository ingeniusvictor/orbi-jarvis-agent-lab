import assert from 'node:assert/strict'
import {
  probeSpeakerDiarization,
  sherpaRuntimeRequire,
  speakerDiarizationPaths,
} from '../bridge/orbia/speaker-diarization-probe.mjs'
import { diarizeLocalWav } from '../bridge/orbia/speaker-diarization.mjs'

function makeVoiceLikeWav({
  sampleRate = 16000,
  seconds = 6,
} = {}) {
  const count = Math.floor(sampleRate * seconds)
  const buffer = new ArrayBuffer(44 + count * 2)
  const view = new DataView(buffer)
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  write(0, 'RIFF')
  view.setUint32(4, 36 + count * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, count * 2, true)

  for (let i = 0; i < count; i++) {
    const t = i / sampleRate
    const envelope = 0.25 + 0.2 * Math.sin(2 * Math.PI * 2.1 * t)
    const sample =
      envelope *
      (
        0.55 * Math.sin(2 * Math.PI * 175 * t) +
        0.3 * Math.sin(2 * Math.PI * 350 * t) +
        0.15 * Math.sin(2 * Math.PI * 525 * t)
      )
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true)
  }

  return new Uint8Array(buffer)
}

const readiness = probeSpeakerDiarization()
assert.equal(
  readiness.available,
  true,
  'Diarization runtime/models are not installed.',
)

const runtimeRequire = sherpaRuntimeRequire()
assert.ok(runtimeRequire, 'sherpa-onnx-node runtime could not be resolved.')

const sherpa = runtimeRequire('sherpa-onnx-node')
assert.equal(typeof sherpa.OfflineSpeakerDiarization, 'function')
assert.equal(typeof sherpa.SpeakerEmbeddingExtractor, 'function')

const paths = speakerDiarizationPaths()
const extractor = new sherpa.SpeakerEmbeddingExtractor({
  model: paths.embeddingModel,
  numThreads: 1,
  debug: false,
})

const sampleRate = 16000
const samples = new Float32Array(sampleRate * 4)
for (let i = 0; i < samples.length; i++) {
  const t = i / sampleRate
  samples[i] =
    0.25 * Math.sin(2 * Math.PI * 180 * t) +
    0.08 * Math.sin(2 * Math.PI * 360 * t)
}

const stream = extractor.createStream()
stream.acceptWaveform({ sampleRate, samples })
const embedding = extractor.compute(stream)
assert.ok(embedding && embedding.length > 0, 'Speaker embedding is empty.')
assert.ok(
  Array.from(embedding).every((value) => Number.isFinite(Number(value))),
  'Speaker embedding contains non-finite values.',
)

const result = diarizeLocalWav(makeVoiceLikeWav())
assert.equal(result.provider, 'sherpa-onnx-local')
assert.equal(result.sampleRate, 16000)
assert.ok(Array.isArray(result.segments))

console.log('Native sherpa-onnx runtime: PASS')
console.log(`Package location: ${readiness.packageLocation}`)
console.log(`Speaker embedding: PASS · ${embedding.length} dimensions`)
console.log(`Diarization inference: PASS · ${result.speakerCount} speaker cluster(s) on synthetic audio`)
console.log('No cloud service was used.')
