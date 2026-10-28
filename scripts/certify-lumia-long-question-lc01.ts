import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LONG_QUESTION_ASSEMBLY_CAP_MS,
  LONG_QUESTION_CAPTURE_CAP_MS,
  LONG_QUESTION_AFTER_TRANSCRIPT_MS,
  isLongCommandSegment,
  remainingLongQuestionWindow,
  shouldDeferLongQuestion,
} from '../src/lib/long-question'
const file = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

assert.equal(isLongCommandSegment('command', 20_000, true), true)
assert.equal(isLongCommandSegment('command', 8_000, true), true)
assert.equal(isLongCommandSegment('command', 7_999, true), false)
assert.equal(isLongCommandSegment('command', 20_000, false), false)
assert.equal(isLongCommandSegment('wake', 20_000, true), false)
assert.equal(isLongCommandSegment('guard', 20_000, true), false)
assert.equal(isLongCommandSegment('deaf', 20_000, true), false)
assert.equal(isLongCommandSegment('command', Number.NaN, true), false)
assert.equal(LONG_QUESTION_AFTER_TRANSCRIPT_MS, 2400)
assert.equal(LONG_QUESTION_CAPTURE_CAP_MS, 100_000)
assert.equal(LONG_QUESTION_ASSEMBLY_CAP_MS, 90_000)
assert.equal(remainingLongQuestionWindow(10_000, 40_000), 70_000)
assert.equal(remainingLongQuestionWindow(10_000, 110_000), 0)
assert.equal(remainingLongQuestionWindow(10_000, 112_000), 0)
assert.equal(remainingLongQuestionWindow(10_000, 9_000), 0)

const v = (extra: Record<string, unknown> = {}) => ({
  active: true, elapsedFromFirstMs: 2200, elapsedFromLastMs: 400,
  queuedCommand: false, recordingCommand: false, ...extra,
})
assert.equal(shouldDeferLongQuestion(v()), true)
assert.equal(shouldDeferLongQuestion(v({ elapsedFromLastMs: 2400 })), false)
assert.equal(shouldDeferLongQuestion(v({ elapsedFromLastMs: 3300, queuedCommand: true })), true)
assert.equal(shouldDeferLongQuestion(v({ elapsedFromLastMs: 3300, recordingCommand: true })), true)
assert.equal(shouldDeferLongQuestion(v({ elapsedFromFirstMs: 90_000 })), false)
assert.equal(shouldDeferLongQuestion(v({ active: false })), false)

const voice = file('src/lib/voice.ts')
const app = file('src/App.tsx')
const launcher = file('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const diagnostics = file('src/ui/Diagnostics.tsx')
assert.match(voice, /onEnd: \(blob, durationMs\) =>/)
assert.match(voice, /isLongCommandSegment\(/)
assert.match(voice, /shouldDeferLongQuestion\(/)
assert.match(voice, /longQuestionActive = false/)
assert.match(voice, /pendingAudio\.some\(/)
assert.match(app, /onLongSpeechSegment,/)
assert.match(app, /remainingLongQuestionWindow\(/)
assert.match(app, /!commandGraceUsed\.current/)
assert.match(launcher, /set "VITE_LUMIA_LONG_QUESTION_INPUT=1"/)
assert.match(diagnostics, /long question assembling/)
console.log('LUMIA LC-01 bounded long-command VAD/Whisper union contracts: PASS')
