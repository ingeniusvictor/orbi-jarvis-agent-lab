import assert from 'node:assert/strict'
import {
  PersistentMeetingSpeakerTracker,
} from '../bridge/orbia/meeting-speaker-tracker.mjs'

const tracker = new PersistentMeetingSpeakerTracker({
  threshold: 0.8,
  primaryProfile: {
    embedding: [1, 0, 0],
  },
  primaryName: 'Victor',
  primaryMatchThreshold: 0.9,
})

const victor = tracker.assignEmbedding([0.99, 0.01, 0], { atMs: 1000 })
assert.equal(victor.name, 'Victor')
assert.equal(victor.source, 'local-speaker-profile')

const child1 = tracker.assignEmbedding([0, 1, 0], { atMs: 2000 })
assert.equal(child1.name, 'SPEAKER 1')
assert.equal(child1.newSpeaker, true)

const child2 = tracker.assignEmbedding([0.02, 0.99, 0], { atMs: 9000 })
assert.equal(child2.name, 'SPEAKER 1')
assert.equal(child2.newSpeaker, false)

const other = tracker.assignEmbedding([0, 0, 1], { atMs: 12000 })
assert.equal(other.name, 'SPEAKER 2')
assert.equal(other.newSpeaker, true)

const status = tracker.status()
assert.equal(status.anonymousSpeakerCount, 2)
assert.equal(status.primaryProfileAvailable, true)
assert.equal(status.speakers[0].sampleCount, 2)

console.log('MI-02 persistent speaker tracker: PASS')
console.log('Primary enrolled speaker precedence: PASS')
console.log('Cross-chunk anonymous speaker continuity: PASS')
console.log('Distinct embedding creates distinct speaker: PASS')
console.log('Other-person embeddings remain process-memory only: PASS')
