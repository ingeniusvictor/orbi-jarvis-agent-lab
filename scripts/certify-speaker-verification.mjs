import assert from 'node:assert/strict'
import {
  averageSpeakerEmbeddings,
  cosineSimilarity,
  speakerVerificationStatus,
} from '../bridge/orbia/speaker-verification.mjs'

const same = cosineSimilarity([1, 0, 0], [2, 0, 0])
assert.ok(Math.abs(same - 1) < 1e-9)

const orthogonal = cosineSimilarity([1, 0], [0, 1])
assert.ok(Math.abs(orthogonal) < 1e-9)

const opposite = cosineSimilarity([1, 0], [-1, 0])
assert.ok(Math.abs(opposite + 1) < 1e-9)

const mean = averageSpeakerEmbeddings([
  [1, 0],
  [1, 0],
  [0.9, 0.1],
])
assert.equal(mean.length, 2)
assert.ok(mean[0] > mean[1])

assert.throws(
  () => averageSpeakerEmbeddings([]),
  /At least one speaker embedding/,
)

const status = speakerVerificationStatus({ env: {} })
assert.equal(typeof status.engineReady, 'boolean')
assert.equal(typeof status.enrolled, 'boolean')
assert.equal(typeof status.available, 'boolean')
assert.equal(status.threshold, 0.6)

console.log('VG-02 speaker verification contracts: PASS')
console.log('Cosine similarity: PASS')
console.log('Embedding averaging: PASS')
console.log('Default threshold: 0.60 (provisional)')
console.log('DPAPI enrollment remains Windows/local-only.')
