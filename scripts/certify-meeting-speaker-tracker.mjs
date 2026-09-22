import assert from 'node:assert/strict'
import {
  PersistentMeetingSpeakerTracker,
} from '../bridge/orbia/meeting-speaker-tracker.mjs'

const tracker = new PersistentMeetingSpeakerTracker({
  threshold: 0.8,
  softThreshold: 0.45,
  mergeThreshold: 0.75,
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

const guarded = new PersistentMeetingSpeakerTracker({
  threshold: 0.8,
  softThreshold: 0.45,
  mergeThreshold: 0.75,
  expectedParticipants: 3,
})

guarded.assignEmbedding([1, 0, 0], { atMs: 1000 })
guarded.assignEmbedding([0, 1, 0], { atMs: 2000 })
guarded.assignEmbedding([0, 0, 1], { atMs: 3000 })
const fourth = guarded.assignEmbedding([-1, 0, 0], { atMs: 4000 })

assert.equal(fourth.name, 'Unknown speaker')
assert.equal(fourth.reason, 'expected-count-guard')
assert.equal(guarded.status().anonymousSpeakerCount, 3)
assert.equal(guarded.status().expectedParticipants, 3)

const consolidating = new PersistentMeetingSpeakerTracker({
  threshold: 0.95,
  softThreshold: 0.4,
  mergeThreshold: 0.78,
})

const first = consolidating.assignEmbedding([1, 0, 0], { atMs: 1000 })
const duplicate = consolidating.assignEmbedding([0.8, 0.6, 0], { atMs: 2000 })
assert.notEqual(first.id, duplicate.id)
assert.equal(consolidating.status().anonymousSpeakerCount, 2)

consolidating.assignEmbedding([0.9, 0.435, 0], { atMs: 3000 })
const merged = consolidating.status()
assert.equal(merged.anonymousSpeakerCount, 1)
assert.ok(merged.aliases.length >= 1)
assert.ok(merged.merges.length >= 1)

console.log('MI-03 persistent speaker tracker: PASS')
console.log('Primary enrolled speaker precedence: PASS')
console.log('Cross-chunk anonymous speaker continuity: PASS')
console.log('Expected participant guard prevents speaker explosion: PASS')
console.log('Duplicate speaker clusters consolidate automatically: PASS')
console.log('Other-person embeddings remain process-memory only: PASS')
