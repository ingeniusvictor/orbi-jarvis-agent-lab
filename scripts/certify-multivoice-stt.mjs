import assert from 'node:assert/strict'
import {
  encodeMonoPcm16Wav,
  mergeSpeakerSegments,
} from '../bridge/orbia/multivoice-stt.mjs'
import { decodeMonoPcm16Wav } from '../bridge/orbia/speaker-diarization.mjs'

const merged = mergeSpeakerSegments([
  { start: 0.0, end: 0.7, speaker: 0 },
  { start: 0.8, end: 1.4, speaker: 0 },
  { start: 1.5, end: 2.2, speaker: 1 },
  { start: 2.3, end: 2.5, speaker: 1 }, // too short if left alone
])

assert.equal(merged.length, 2)
assert.deepEqual(merged[0], {
  start: 0,
  end: 1.4,
  speaker: 0,
})
assert.deepEqual(merged[1], {
  start: 1.5,
  end: 2.5,
  speaker: 1,
})

const input = new Float32Array([0, 0.25, -0.25, 0.75, -0.75])
const wav = encodeMonoPcm16Wav(input, 16000)
const decoded = decodeMonoPcm16Wav(wav)

assert.equal(decoded.sampleRate, 16000)
assert.equal(decoded.samples.length, input.length)
assert.ok(Math.abs(decoded.samples[1] - input[1]) < 0.001)
assert.ok(Math.abs(decoded.samples[2] - input[2]) < 0.001)

console.log('Multivoice STT helper contracts: PASS')
console.log('Same-speaker nearby segments: merged')
console.log('PCM16 speaker slices: round-trip valid')
console.log('Native diarization + Whisper execution remains explicit/local-only')
