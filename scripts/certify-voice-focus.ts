import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ACTIVE_COMMAND_GRACE_MS,
  isNonSpeechTranscript,
  isRapidDuplicateTranscript,
  shouldDropStaleVoiceSegment,
  shouldInterruptBusyAssistant,
  transcriptSegmentIsStillActive,
  voiceModeForPhase,
} from '../src/lib/voice-focus'

assert.equal(
  shouldDropStaleVoiceSegment('command', 'command'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('command', 'guard'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('command', 'wake'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('wake', 'wake'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('wake', 'command'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('guard', 'command'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('deaf', 'deaf'),
  true,
)
assert.equal(transcriptSegmentIsStillActive(), false)

console.log('Voice Focus V0 turn isolation smoke test: PASS')
console.log('Queued command audio cannot leak into a later answer.')
console.log('Finished Whisper segments do not inherit unrelated live mic activity.')
console.log('Guard -> command remains allowed for legitimate barge-in transcription.')


const wake = /\b(?:lumi|lumia)\b/i
const override = /^(?:para|espera|cancela)$/i
const bareWake = /^(?:lumi|lumia)[,.!?]*$/i

assert.equal(
  shouldInterruptBusyAssistant('mi hijo está hablando al lado', {
    wake,
    override,
    bareWake,
  }),
  false,
)
assert.equal(
  shouldInterruptBusyAssistant('Lumi, espera un momento', {
    wake,
    override,
    bareWake,
  }),
  true,
)
assert.equal(
  shouldInterruptBusyAssistant('para', {
    wake,
    override,
    bareWake,
  }),
  true,
)
assert.equal(
  shouldInterruptBusyAssistant('Lumi.', {
    wake,
    override,
    bareWake,
  }),
  false,
)
assert.equal(
  shouldInterruptBusyAssistant('Lumi, para', {
    wake,
    override,
    bareWake,
  }),
  true,
)

console.log('Household Focus guard policy: PASS')
console.log('Ambient busy-time speech stays observable but cannot hijack the turn.')
console.log('Explicit Lumi/interrupt phrases remain valid barge-in controls.')


assert.equal(isNonSpeechTranscript('[Música]'), true)
assert.equal(isNonSpeechTranscript('[Music]'), true)
assert.equal(isNonSpeechTranscript('(silencio)'), true)
assert.equal(isNonSpeechTranscript('Lumi, explícame un MPPT'), false)
assert.equal(isNonSpeechTranscript('O.R.B.I.A.'), false)

console.log('Non-speech annotation filter: PASS')
console.log('Music/silence/noise annotations remain visible but never become commands.')


assert.equal(voiceModeForPhase('dormant'), 'wake')
assert.equal(voiceModeForPhase('waking'), 'guard')
assert.equal(voiceModeForPhase('listening'), 'command')
assert.equal(voiceModeForPhase('speaking'), 'guard')

assert.equal(
  isRapidDuplicateTranscript(
    '¿Puedes explicarme qué es un MPPT?',
    'Puedes explicarme que es un MPPT.',
    900,
  ),
  true,
)
assert.equal(
  isRapidDuplicateTranscript(
    '¿Puedes explicarme qué es un MPPT?',
    'Puedes explicarme que es un MPPT.',
    4000,
  ),
  false,
)
assert.equal(
  isRapidDuplicateTranscript(
    'Lumi',
    'Lumi, para',
    500,
  ),
  false,
)

console.log('Wake acknowledgement isolation: PASS')
console.log('WAKING maps to GUARD, so L.U.M.I.A. cannot submit "¡Aquí!" as a user command.')
console.log('Rapid exact STT duplicate suppression: PASS')

// Bounded opt-in command grace: never an unconditional WAKE/GUARD extension.
assert.equal(ACTIVE_COMMAND_GRACE_MS, 35_000)
const localVoiceSource = readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.match(localVoiceSource, /provider === 'local' && mode === 'command' && ACTIVE_COMMAND_GRACE_ENABLED/)
assert.match(appSource, /if \(!commandGraceUsed\.current\)/)
assert.match(appSource, /commandGraceUsed\.current = true/)
assert.match(appSource, /ACTIVE_COMMAND_GRACE_MS - \(Date\.now\(\) - startedAt\)/)
assert.match(appSource, /scheduleCommandExpiry\(remainingMs\)/)
assert.match(appSource, /setTimeout\(expireListening, 400\)/)
console.log('ASUS one-shot command/STT grace opt-in wiring: PASS')
