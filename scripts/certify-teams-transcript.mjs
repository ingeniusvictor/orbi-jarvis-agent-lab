import assert from 'node:assert/strict'
import {
  parseTeamsTranscriptVtt,
  teamsTranscriptCapabilities,
} from '../bridge/orbia/teams-transcript.mjs'

const sample = `WEBVTT

00:00:01.000 --> 00:00:04.000
<v Raul Serrano>Tenemos que revisar los trackers.</v>

00:00:04.500 --> 00:00:08.000
<v Victor Leon>Yo puedo revisarlos mañana en terreno.</v>

00:00:08.100 --> 00:00:10.000
Sin atribución disponible.
`

const turns = parseTeamsTranscriptVtt(sample)
assert.equal(turns.length, 3)
assert.equal(turns[0].speakerName, 'Raul Serrano')
assert.equal(turns[0].speakerIdentitySource, 'platform')
assert.equal(turns[1].speakerName, 'Victor Leon')
assert.equal(turns[1].startedAtMs, 4500)
assert.equal(turns[2].speakerName, 'Unknown speaker')
assert.equal(turns[2].speakerIdentitySource, 'anonymous')

const caps = teamsTranscriptCapabilities()
assert.equal(caps.postMeetingGraphTranscript, true)
assert.equal(caps.liveGraphTranscript, false)

console.log('Meeting M3 Teams WebVTT adapter: PASS')
console.log('Speaker-attributed voice tags: PASS')
console.log('Timestamp normalization: PASS')
console.log('Unattributed fallback: PASS')
