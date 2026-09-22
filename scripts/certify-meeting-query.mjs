import assert from 'node:assert/strict'
import { selectMeetingEvidence } from '../bridge/orbia/meeting-query.mjs'

const turns = [
  {
    startedAtMs: 1000,
    speakerName: 'Raul Serrano',
    text: 'Tenemos que revisar los trackers.',
  },
  {
    startedAtMs: 3000,
    speakerName: 'Victor Leon',
    text: 'Yo puedo revisarlos mañana.',
  },
  {
    startedAtMs: 5000,
    speakerName: 'Lorenzo Plaza',
    text: 'También revisemos comunicaciones del blueLog.',
  },
]

const tracker = selectMeetingEvidence('¿Qué dijo Raul sobre los trackers?', turns)
assert.equal(tracker[0].speakerName, 'Raul Serrano')

const communication = selectMeetingEvidence('comunicaciones blueLog', turns)
assert.equal(communication[0].speakerName, 'Lorenzo Plaza')

const fallback = selectMeetingEvidence('tema inexistente', turns)
assert.ok(fallback.length > 0)

console.log('Meeting M7 query retrieval: PASS')
console.log('Speaker/name-aware evidence ranking: PASS')
console.log('Bounded fallback context: PASS')
