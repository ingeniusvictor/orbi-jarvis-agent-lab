import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const css=load('src/index.css')
const review=load('src/ui/AudioTranslationReview.tsx')
const hud=load('src/ui/Hud.tsx')

// Actual owner bug: review buttons were painted on the HUD while the ancestor
// .hud inherited pointer-events:none. The child must explicitly opt back in.
const root=css.match(/\.hud\s*\{([^}]+)\}/)?.[1]??''
const control=css.match(/\.lumia-audio-review\s*\{([^}]+)\}/)?.[1]??''
const interactive=css.match(/\.lumia-audio-review button,\s*\.lumia-audio-review textarea\s*\{([^}]+)\}/)?.[1]??''
const pane=css.match(/\.voice-pane\s*\{([^}]+)\}/)?.[1]??''
assert.match(root,/pointer-events:\s*none;/)
assert.match(control,/pointer-events:\s*auto;/)
assert.match(interactive,/pointer-events:\s*auto;/)
// Do NOT make the entire transparent hologram pane swallow 3D interaction.
assert.doesNotMatch(pane,/pointer-events:\s*auto;/)
assert.match(review,/onClick=\{open\}/)
assert.match(review,/setEditing\(true\)/)
assert.match(review,/onClick=\{cancel\}/)
assert.match(review,/editor\.focus\(\{preventScroll:true\}\)/)
assert.match(review,/editor\.scrollIntoView\(\{block:'nearest',behavior:'smooth'\}\)/)
assert.match(review,/cancelAnimationFrame\(frame\)/)
assert.match(review,/onClick=\{\(\)=>\{void retry\(\)\}\}/)
assert.match(review,/translateLocalText\(corrected,data\.source,data\.target\)/)
assert.doesNotMatch(review,/audioBlobToPcmWav|transcribeTranslationAudio/)
assert.match(hud,/<AudioTranslationReview turnId=\{turn\.id\} text=\{turn\.text\}/)
console.log('LT-05C: review click restoration, editor focus and scroll, private text-only retry PASS')
