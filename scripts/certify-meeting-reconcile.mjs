import assert from 'node:assert/strict'
import {
  reconcileMeetingTurns,
  textSimilarity,
  temporalOverlap,
} from '../bridge/orbia/meeting-reconcile.mjs'

assert.ok(textSimilarity('revisemos los trackers', 'revisar los trackers') > 0.4)
assert.ok(
  temporalOverlap(
    { startedAtMs: 1000, endedAtMs: 4000 },
    { startedAtMs: 1200, endedAtMs: 3900 },
  ) > 0.7,
)

const local = [
  {
    id: 'local-1',
    startedAtMs: 1000,
    endedAtMs: 4000,
    speakerName: 'SPEAKER 1',
    speakerIdentitySource: 'diarization',
    text: 'Tenemos que revisar los trackers.',
  },
  {
    id: 'local-2',
    startedAtMs: 4500,
    endedAtMs: 8000,
    speakerName: 'SPEAKER 2',
    speakerIdentitySource: 'diarization',
    text: 'Yo los reviso mañana.',
    markedImportant: true,
  },
]

const teams = [
  {
    startedAtMs: 1000,
    endedAtMs: 4100,
    speakerId: 'teams-name:raul',
    speakerName: 'Raul Serrano',
    speakerIdentitySource: 'platform',
    text: 'Tenemos que revisar los trackers.',
  },
  {
    startedAtMs: 4500,
    endedAtMs: 8000,
    speakerId: 'teams-name:victor',
    speakerName: 'Victor Leon',
    speakerIdentitySource: 'platform',
    text: 'Yo los reviso mañana.',
  },
]

const canonical = reconcileMeetingTurns(local, teams)
assert.equal(canonical.length, 2)
assert.equal(canonical[0].speakerName, 'Raul Serrano')
assert.equal(canonical[1].speakerName, 'Victor Leon')
assert.equal(canonical[1].markedImportant, true)
assert.equal(canonical[0].reconciled, true)

console.log('Meeting transcript reconciliation: PASS')
console.log('Teams names override anonymous diarization: PASS')
console.log('Raw local annotations survive reconciliation: PASS')
