import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  focusedVadThreshold,
  focusedVadOnsetMs,
  FOCUS_WAKE_MIN_RMS,
} from '../src/lib/near-field-focus'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

assert.equal(focusedVadThreshold(.02, 'wake', true, false), .02 * 1.25)
assert.equal(focusedVadThreshold(.02, 'command', true, false), .02 * 1.08)
assert.equal(focusedVadThreshold(.002, 'wake', true, false), FOCUS_WAKE_MIN_RMS)
assert.equal(focusedVadThreshold(.02, 'guard', true, false), .02)
assert.equal(focusedVadThreshold(.02, 'wake', true, true), .02)
assert.equal(focusedVadThreshold(.02, 'wake', false, false), .02)
assert.equal(focusedVadThreshold(.02, 'command', false, false), .02)
assert.equal(focusedVadThreshold(.02, 'deaf', true, false), .02)
assert.equal(focusedVadThreshold(Number.NaN, 'wake', true, false), Number.NaN)
assert.equal(focusedVadOnsetMs(110, 'wake', true, false), 170)
assert.equal(focusedVadOnsetMs(110, 'command', true, false), 110)
assert.equal(focusedVadOnsetMs(110, 'wake', true, true), 110)
assert.equal(focusedVadOnsetMs(110, 'wake', false, false), 110)

const audio = read('src/lib/audio.ts')
const vad = read('src/lib/vad.ts')
const voice = read('src/lib/voice.ts')
const launcher = read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const diag = read('src/ui/Diagnostics.tsx')
assert.match(audio, /autoGainControl: !NEAR_FIELD_FOCUS/)
assert.match(audio, /noiseSuppression: true/)
assert.match(audio, /echoCancellation: true/)
assert.match(vad, /threshold = focusedVadThreshold/)
assert.match(vad, /now - armedAt >= onsetMs/)
assert.match(vad, /const release = threshold \* RELEASE_RATIO/)
assert.match(voice, /nearFieldFocus: NEAR_FIELD_FOCUS_ENABLED && provider === 'local'/)
assert.match(voice, /microphoneAutoGainObserved/)
assert.match(launcher, /set "VITE_LUMIA_NEAR_FIELD_FOCUS=1"/)
assert.match(diag, /mic RMS \/ ambient \/ trigger/)
assert.ok(!voice.includes('verifySpeakerWav('))
assert.ok(!voice.includes('ORBI_VOICE_GATE_MODE=enforce'))
console.log('LUMIA NF-01: opt-in near-field wake focus, low command impact, household Voice Gate unchanged: PASS')
console.log('No speaker identification claim, no new audio storage, no main changes.')
