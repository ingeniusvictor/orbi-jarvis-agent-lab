import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const review=read('src/ui/AudioTranslationReview.tsx')
const hud=read('src/ui/Hud.tsx')
const store=read('src/store.ts')
const existing=read('scripts/certify-lumia-translate-review-lt05b.ts')
// The original translation remains completed at the ORIGINAL finish time.
// Manual typing time may be minutes, and must not inflate model performance.
assert.match(store,/retranslatedAt\?: number/)
assert.match(store,/retranslationMs\?: number/)
assert.match(review,/const retranslationStartedAt=performance\.now\(\)/)
assert.match(review,/const retranslatedAt=Date\.now\(\)/)
assert.match(review,/const retranslationMs=Math\.round\(performance\.now\(\)-retranslationStartedAt\)/)
assert.match(review,/retranslatedAt,retranslationMs/)
assert.doesNotMatch(review,/finishedAt:Date\.now\(\)/)
assert.match(hud,/Fin \{timeLabel\(turn\.finishedAt\)\}/)
assert.match(hud,/Retraducido \{timeLabel\(turn\.retranslatedAt\)\}/)
assert.match(hud,/turn\.retranslationMs \/ 1000/)
assert.match(existing,/Transcripción original/)
console.log('LT-05D: original Whisper/Qwen latency immutable; manual Qwen retry measured independently PASS')
