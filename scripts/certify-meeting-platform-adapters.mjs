import assert from 'node:assert/strict'
import {
  normalizePlatformCaptionEvent,
  normalizePlatformParticipantEvent,
  platformIdentityPolicy,
} from '../bridge/orbia/meeting-platform-adapters.mjs'

const participant = normalizePlatformParticipantEvent({
  platform: 'teams',
  platformId: 'aad:123',
  displayName: 'Raul Serrano',
})
assert.equal(participant.displayName, 'Raul Serrano')
assert.equal(participant.platform, 'teams')

const caption = normalizePlatformCaptionEvent({
  platform: 'teams',
  speakerId: 'aad:123',
  speakerName: 'Raul Serrano',
  startedAtMs: 1000,
  endedAtMs: 2300,
  text: '  Revisemos   los trackers. ',
})
assert.equal(caption.text, 'Revisemos los trackers.')
assert.equal(caption.platformSpeakerName, 'Raul Serrano')

const unknown = normalizePlatformCaptionEvent({
  platform: 'teams',
  text: 'Sin nombre.',
})
assert.equal(unknown.platformSpeakerName, null)

const policy = platformIdentityPolicy()
assert.equal(policy.inferIdentityFromDomOrder, false)
assert.equal(policy.unknownFallsBackToDiarization, true)

console.log('Meeting platform event contract: PASS')
console.log('Explicit Teams names preserved: PASS')
console.log('No DOM/avatar identity guessing: PASS')
