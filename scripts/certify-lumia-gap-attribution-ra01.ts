import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { attributePhraseGap } from '../src/lib/phrase-gap-attribution'

const first = attributePhraseGap(0, 500, 950, 1000)
assert.deepEqual(first, {
  gapMs: null, waitingTextMs: null, waitingAudioMs: null, waitingPlaybackMs: null,
})

// Exact observed 14.56s pause could be model text delivered late.
const lateModel = attributePhraseGap(1000, 13200, 15300, 15560)
assert.deepEqual(lateModel, {
  gapMs: 14560, waitingTextMs: 12200,
  waitingAudioMs: 2100, waitingPlaybackMs: 260,
})
// Alternatively, model may have produced text early but Kokoro could be slow.
const slowTts = attributePhraseGap(1000, 200, 15400, 15560)
assert.deepEqual(slowTts, {
  gapMs: 14560, waitingTextMs: 0,
  waitingAudioMs: 14400, waitingPlaybackMs: 160,
})
// WAV is ready before previous audio ends; delay belongs to playback.
const slowPlayback = attributePhraseGap(1000, 200, 500, 15560)
assert.deepEqual(slowPlayback, {
  gapMs: 14560, waitingTextMs: 0,
  waitingAudioMs: 0, waitingPlaybackMs: 14560,
})
assert.deepEqual(attributePhraseGap(1000, 1250, undefined, 1450), {
  gapMs: 450, waitingTextMs: 250,
  waitingAudioMs: null, waitingPlaybackMs: null,
})
const zeroGap = attributePhraseGap(1000, 1000, 1000, 1000)
assert.equal(zeroGap.gapMs, 0)
assert.equal(zeroGap.waitingAudioMs, 0)

const file = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const tts = file('src/lib/tts.ts')
const hud = file('src/ui/Hud.tsx')
const store = file('src/store.ts')
const log = file('src/lib/conversation-timeline.ts')
const diag = file('src/ui/Diagnostics.tsx')
const identity = file('bridge/orbia/lumia-identity.mjs')
assert.match(identity, /no con una exclamación aislada como/)
const avatar = file('src/scene/LumiaAvatar.tsx')
assert.match(tts, /attributePhraseGap\(/)
assert.match(tts, /queuedAt: Date\.now\(\)/)
assert.match(tts, /item\.synthesisReadyAt = Date\.now\(\)/)
assert.match(tts, /notifyPhraseStart\(item\)/)
assert.match(tts, /if \(pumping && PREFETCH_NEXT_PHRASE\) prime\(queue\[0\]\)/)
assert.match(store, /export type SpokenSegment =/)
assert.match(log, /esperando texto del modelo/)
assert.match(log, /Kokoro\/WAV/)
assert.match(log, /Chrome\/reproducción/)
assert.match(hud, /segment\.waitingTextMs/)
assert.match(hud, /segment\.waitingAudioMs/)
assert.match(diag, /gap — waiting model words/)
assert.match(diag, /gap — Kokoro WAV preparation/)
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)
console.log('LUMIA RA-01: observed 14.56s gap attribution cases: PASS')
console.log('All three non-overlapping gap contributors sum to observed time: PASS')
console.log('Avatar and local Kokoro optimizations retained. Windows measurement pending.')
