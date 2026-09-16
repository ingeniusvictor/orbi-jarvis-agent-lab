import assert from 'node:assert/strict'
import {
  decodeMonoPcm16Wav,
  SpeakerDiarizationError,
} from '../bridge/orbia/speaker-diarization.mjs'

function makeMonoPcm16Wav({
  sampleRate = 16000,
  samples = new Int16Array([0, 1200, -1200, 0]),
} = {}) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
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
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true)
  }

  return new Uint8Array(buffer)
}

const decoded = decodeMonoPcm16Wav(makeMonoPcm16Wav())
assert.equal(decoded.sampleRate, 16000)
assert.equal(decoded.samples.length, 4)
assert.equal(decoded.samples[0], 0)
assert.ok(decoded.samples[1] > 0)
assert.ok(decoded.samples[2] < 0)

assert.throws(
  () => decodeMonoPcm16Wav(new Uint8Array(10)),
  (error) =>
    error instanceof SpeakerDiarizationError &&
    error.code === 'DIARIZATION_INVALID_AUDIO',
)

const stereo = makeMonoPcm16Wav()
const stereoView = new DataView(
  stereo.buffer,
  stereo.byteOffset,
  stereo.byteLength,
)
stereoView.setUint16(22, 2, true)

assert.throws(
  () => decodeMonoPcm16Wav(stereo),
  (error) =>
    error instanceof SpeakerDiarizationError &&
    error.code === 'DIARIZATION_UNSUPPORTED_AUDIO',
)

console.log('Speaker diarization adapter contract: PASS')
console.log('PCM16 mono WAV decode: PASS')
console.log('Invalid/stereo audio rejection: PASS')
console.log('Native runtime execution remains local-install dependent.')
