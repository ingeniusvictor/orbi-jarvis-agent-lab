import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  explicitSpokenEmotionVQ05,SpeechExpressionVQ05,
} from '../src/scene/lumia-head/speech-expressions-vq05'

const samples:Array<[string,'joy'|'sorrow'|'fun']>=[
  ['Me alegra que hayamos terminado la prueba.','joy'],
  ['Felicidades por el trabajo.','joy'],
  ['Qué buena noticia, lo logramos.','joy'],
  ['Lo siento mucho, lamento lo ocurrido.','sorrow'],
  ['Vaya sorpresa, no me lo esperaba.','fun'],
  ['Qué divertido estuvo el experimento.','fun'],
]
for(const [phrase,expected] of samples) {
  assert.equal(explicitSpokenEmotionVQ05(phrase),expected,phrase)
}
// No unsolicited inferences about the owner's emotional state or claims
// that a phrase was actually spoken when it was only in a prompt.
for(const phrase of [
  '',
  'La memoria VRAM tiene cuatro gigabytes.',
  'Estoy analizando los estados del sistema.',
  'El usuario parece triste.',
  'No me alegra el resultado.',
  'No estoy feliz por esto.',
  'Explícame una animación natural.',
  'Hay diecisiete archivos FBX disponibles.',
  'Una batar VRM es un avatar humanoide.',
  '¿Me puedes explicar el significado de la palabra felicidades?',
]) {
  assert.equal(explicitSpokenEmotionVQ05(phrase),null,phrase)
}
const frameSeconds=1/60
const engine=new SpeechExpressionVQ05()
const neutral=engine.step(frameSeconds,false)
assert.deepEqual(neutral.weights,{joy:0,sorrow:0,fun:0})
assert.equal(neutral.dominant,null)

// Begin ONLY from actual phrase event. Still neutral before speech onset.
engine.onPhraseAudible('Me alegra que funcione.')
for(let i=0;i<90;i++)engine.step(frameSeconds,false)
assert.deepEqual(engine.step(0,false).weights,{joy:0,sorrow:0,fun:0})
let last=0
for(let i=0;i<100;i++){
  const next=engine.step(frameSeconds,true)
  assert.ok(next.weights.joy>=last-1e-9)
  assert.ok(next.weights.joy<=.28+1e-9)
  assert.ok(next.weights.sorrow===0 && next.weights.fun===0)
  assert.ok(next.weights.joy-last<.03,'no frame-to-frame expression pop')
  last=next.weights.joy
}
assert.ok(last>.25)
assert.equal(engine.step(0,true).dominant,'joy')

// A new audible phrase changes the expression, old one FADES out.
engine.onPhraseAudible('Lo siento mucho.')
let previousJoy=engine.step(0,true).weights.joy
for(let i=0;i<60;i++){
  const f=engine.step(frameSeconds,true)
  assert.ok(f.weights.joy<=previousJoy+1e-9)
  assert.ok(f.weights.joy>=0)
  assert.ok(f.weights.sorrow>=0 && f.weights.sorrow<=.20)
  previousJoy=f.weights.joy
}
assert.equal(engine.step(0,true).dominant,'sorrow')
assert.ok(engine.step(0,true).weights.joy<.01)

// Guided demo has priority over conversational expressions.
engine.onPhraseAudible('Vaya sorpresa.')
for(let i=0;i<90;i++)engine.step(frameSeconds,true,true)
assert.ok(engine.step(0,true,true).weights.fun<.002)
for(let i=0;i<90;i++)engine.step(frameSeconds,true)
assert.ok(engine.step(0,true).weights.fun>.20)

// Interrupted audio fades out without leaving the last face frozen.
engine.onSpeechEnd()
let final=engine.step(0,false)
assert.ok(final.weights.fun>.15)
for(let i=0;i<110;i++)final=engine.step(frameSeconds,false)
assert.ok(final.weights.fun<.001)
assert.equal(final.dominant,null)

// Clamp exceptional frame timings, including invalid values.
const weird=new SpeechExpressionVQ05()
weird.onPhraseAudible('Me alegra que estés aquí.')
assert.deepEqual(weird.step(Number.NaN,true).weights,{joy:0,sorrow:0,fun:0})
const huge=weird.step(120,true)
assert.ok(huge.weights.joy<=.28)
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const renderer=read('src/scene/LumiaPortalHead.tsx')
const qaLauncher=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const dailyLauncher=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const audit=read('src/scene/lumia-motion-r8/avatar-runtime-audit-vq03.ts')
const speech=read('src/scene/lumia-head/portal-speech-events.ts')
assert.match(qaLauncher,/VITE_LUMIA_SPEECH_EXPRESSIONS_VQ05=1/)
assert.doesNotMatch(dailyLauncher,/VITE_LUMIA_SPEECH_EXPRESSIONS_VQ05/)
assert.match(renderer,/speechExpressions\.onPhraseAudible\(data\.text\)/)
assert.match(renderer,/speechExpressions\.onSpeechEnd\(\)/)
assert.match(renderer,/portalSpeechSnapshot\(\)/)
assert.match(renderer,/speechExpressions\.step\(dt,speakingAudio,demoActive\)/)
assert.match(renderer,/rig\.expressions\.get\(name\)\?\.length/)
assert.match(renderer,/values\[name\]=Math\.max\(values\[name\]\?\?0,weight\)/)
assert.match(renderer,/natural-expression-observed/)
assert.match(audit,/natural-expression-observed/)
assert.match(speech,/activeTurn !== turnId/)
assert.match(renderer,/approximateVowel\(speech\.current\.text, elapsed\)/)
assert.match(renderer,/body\?\.step\(dt, phase, speakingAudio\)/)
console.log('VQ-05 PASS: actual phrase-triggered, subtle facial expressions with smooth crossfades, demo priority, viseme/R8 intact, QA only')
