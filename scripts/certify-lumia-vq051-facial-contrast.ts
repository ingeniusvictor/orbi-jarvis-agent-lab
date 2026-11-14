import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  parseLumiaFaceActionVQ051,parseLumiaAvatarAction,
  requestLumiaAvatarFaceVQ051,avatarPresenceSnapshot,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {FacePreviewVQ051} from '../src/scene/lumia-head/face-preview-vq051'
import {SpeechExpressionVQ05} from '../src/scene/lumia-head/speech-expressions-vq05'

const cases: Array<[string,string]>=[
  ['Lumi, muéstrame tu expresión facial de alegría.','joy'],
  ['Lumi, muéstrame una expresión de tristeza.','sorrow'],
  ['Lumi, pon cara de sorpresa.','fun'],
  ['Lumi, muéstrame tu expresión de enojo.','angry'],
  ['Lumi, pon cara neutral.','neutral'],
  ['Lumia, enséñame la expresión de felicidad.','joy'],
]
for(const [phrase,preset] of cases){
  assert.deepEqual(parseLumiaFaceActionVQ051(phrase),{kind:'face',preset},phrase)
}
for(const phrase of [
  'Lumi, explícame cómo se hacen las expresiones de tristeza',
  'Lumi, ¿por qué se parecen tus expresiones?',
  'Lumi, muéstrame la animación de alegría',
  'Lumi, ejecuta animación happy',
  'Lumi, di una frase de alegría',
  'Lumi, ¿qué significa sorpresa?',
  'Lumi, quiero ver tu rostro de medio cuerpo',
  'Lumi, muéstrame expresiones de alegría y tristeza',
  'Lumi, muéstrame algo divertido en internet',
]){
  assert.equal(parseLumiaFaceActionVQ051(phrase),null,phrase)
}
assert.deepEqual(parseLumiaAvatarAction('Lumi, ejecuta animación happy'),{kind:'motion',id:'happy'})

const fps=1/60
const driver=new FacePreviewVQ051()
let last=0
driver.cue('joy')
for(let i=0;i<200;i++){
  const frame=driver.step(fps)
  const x=frame.weights.joy
  assert.ok(x>=last-1e-8 && x<=.800001,'smooth, bounded face rise')
  assert.ok(x-last<.08,'no sudden morph jump')
  assert.ok(frame.weights.fun===0 && frame.weights.sorrow===0 && frame.weights.angry===0)
  last=x
}
assert.ok(last>.79,'high-contrast face should be clearly readable')
for(let i=0;i<240;i++)driver.step(fps)
assert.ok(driver.step(fps).weights.joy>.78,'hold enough to inspect after spoken response')
let end=driver.step(0)
for(let i=0;i<400;i++)end=driver.step(fps)
assert.equal(end.active,false,'must exit owner preview automatically')
assert.ok(end.weights.joy<.001,'must return to neutral')

driver.cue('sorrow')
for(let i=0;i<75;i++)driver.step(fps)
const sorrow=driver.step(0)
assert.ok(sorrow.weights.sorrow>.79)
driver.cue('angry')
for(let i=0;i<110;i++)driver.step(fps)
const angry=driver.step(0)
assert.ok(angry.weights.angry>.79)
assert.ok(angry.weights.sorrow<.001)
driver.cue('neutral')
for(let i=0;i<120;i++)driver.step(fps)
const neutral=driver.step(0)
assert.ok(Object.values(neutral.weights).every(x=>x<.001))

driver.cue('fun')
for(let i=0;i<80;i++)driver.step(fps)
assert.ok(driver.step(0).weights.fun>.79)
for(let i=0;i<100;i++)driver.step(fps,true)
const blocked=driver.step(0,true)
assert.ok(Object.values(blocked.weights).every(x=>x<.001))
assert.equal(blocked.active,false)
for(let i=0;i<90;i++)driver.step(fps,false)
assert.equal(driver.step(0).active,false,'guided demo must not replay canceled preview')

const auto=new SpeechExpressionVQ05()
auto.onPhraseAudible('Me alegra saberlo.')
let spoken=auto.step(0,true)
for(let i=0;i<70;i++)spoken=auto.step(fps,true)
assert.ok(spoken.weights.joy>.45 && spoken.weights.joy<.49,
  'conversation should be legible but softer than explicit .80 demo')
const before=avatarPresenceSnapshot().sequence
assert.equal(requestLumiaAvatarFaceVQ051('joy'),true)
const presence=avatarPresenceSnapshot()
assert.equal(presence.view,'head-vrm')
assert.equal(presence.face?.preset,'joy')
assert.ok((presence.face?.sequence??0)>before)
assert.equal(requestLumiaAvatarFaceVQ051('unknown' as 'joy'),false)

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const app=read('src/App.tsx')
const renderer=read('src/scene/LumiaPortalHead.tsx')
const qa=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const audit=read('src/scene/lumia-motion-r8/avatar-runtime-audit-vq03.ts')
assert.match(qa,/VITE_LUMIA_FACE_DIRECT_VQ051=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_FACE_DIRECT_VQ051/)
assert.match(app,/parseLumiaFaceActionVQ051\(said\)/)
assert.match(renderer,/facePreview\.cue\(faceCmd\.preset\)/)
assert.match(renderer,/facePreview\.step\(dt,guidedDemoSnapshot\(\)\.active\)/)
assert.match(renderer,/values\[name\]=weight/)
assert.match(renderer,/rig\.expressions\.get\(faceCmd\.preset\)/)
assert.match(renderer,/face-preview-observed/)
assert.match(audit,/face-preview-unavailable/)
assert.match(renderer,/approximateVowel\(speech\.current\.text, elapsed\)/)
assert.match(renderer,/body\?\.step\(dt, phase, speakingAudio\)/)
console.log('VQ-05.1 PASS: explicitly requested real VRM facial contrasts, smooth neutral return, no R8 hijack or daily changes')
