import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { motionCatalog } from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {
 LUMIA_GUIDED_DEMO_STEPS, guidedDemoScript, guidedDemoSnapshot,
 beginGuidedDemo, cueGuidedDemoPhrase, endGuidedDemo,
 cancelGuidedDemo, currentGuidedFaceExpression, checkGuidedDemoAssets,
} from '../src/scene/lumia-motion-r8/avatar-demo-ph045'
import {
 avatarPresenceSnapshot, setLumiaAvatarView,
 parseLumiaAvatarAction,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {
 portalSpeechStart, portalSpeechPhrase, portalSpeechEnd, portalSpeechSnapshot,
} from '../src/scene/lumia-head/portal-speech-events'

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
assert.equal(motionCatalog.length,17)
const motionSteps=LUMIA_GUIDED_DEMO_STEPS.filter(x=>x.type==='motion')
const faceSteps=LUMIA_GUIDED_DEMO_STEPS.filter(x=>x.type==='face')
assert.equal(motionSteps.length,17)
assert.deepEqual(motionSteps.map(x=>x.motionId),motionCatalog.map(x=>x.id))
assert.deepEqual(faceSteps.map(x=>x.expression),['joy','sorrow','angry','fun','neutral'])
assert.equal(LUMIA_GUIDED_DEMO_STEPS.length,25,'Intro + 17 body + transition + 5 face + outro')
for (const step of LUMIA_GUIDED_DEMO_STEPS) {
 assert.ok(guidedDemoScript().includes(step.speech))
 assert.ok(step.speech.trim().endsWith('.'))
}
const userExamples=[
 'Lumi, puedes hacer una demostración de tus animaciones.',
 'Lumia, haz una demostración de tus movimientos.',
 'Lumi, muéstrame una demostración de tu avatar.',
 'Lumi, quiero ver una demostración de tus expresiones.',
 'Lumi, puedes mostrar una demo de tus habilidades.',
 'Lumi, muéstrame tus animaciones.',
]
for(const said of userExamples){
 assert.deepEqual(parseLumiaAvatarAction(said),{kind:'demo'},said)
}
for(const said of [
 'Lumi, detén la demostración',
 'Lumi, para la demo',
 'Lumi, cancela esta demostración',
])assert.deepEqual(parseLumiaAvatarAction(said),{kind:'demo-stop'},said)
for(const said of [
 'Lumi, ¿cómo se crean animaciones con Blender?',
 'Lumi, ¿puedes explicar cómo hacer una demo de animaciones?',
 'Mi hijo quiere aprender a hacer una demostración de videojuegos.',
 'Lumi, ¿cuáles son tus diecisiete animaciones disponibles?',
])assert.ok(parseLumiaAvatarAction(said)?.kind!=='demo',said)
assert.deepEqual(parseLumiaAvatarAction('Lumia activa la versión de medio cuerpo.'),{kind:'view',view:'bust-vrm'})
assert.deepEqual(parseLumiaAvatarAction('Lumi cambia la versión de cuerpo medio.'),{kind:'view',view:'bust-vrm'})

let headCount=0
const headOk=async (_url:RequestInfo|URL, options?:RequestInit) => {
 assert.equal(options?.method,'HEAD')
 headCount++
 return {ok:true,headers:new Headers({'content-type':'application/octet-stream'})} as Response
}
const ok=await checkGuidedDemoAssets(headOk as typeof fetch)
assert.deepEqual(ok,{available:true,missing:[]})
assert.equal(headCount,17)
const fakeMissing=async (_url:RequestInfo|URL)=>({
 ok:true,headers:new Headers({'content-type':'text/html; charset=utf-8'}),
}) as Response
const fail=await checkGuidedDemoAssets(fakeMissing as typeof fetch)
assert.equal(fail.available,false,'SPA history fallback HTML is NOT a valid FBX')
assert.equal(fail.missing.length,17)

const before=avatarPresenceSnapshot().view
setLumiaAvatarView('head-vrm')
beginGuidedDemo('guide-1')
assert.equal(guidedDemoSnapshot().active,true)
assert.equal(avatarPresenceSnapshot().view,'body-vrm')
assert.equal(guidedDemoSnapshot().completed,0)
cueGuidedDemoPhrase('guide-other',motionSteps[0].speech)
assert.equal(guidedDemoSnapshot().completed,0,'Different turn cannot animate this one')
cueGuidedDemoPhrase('guide-1','Unrelated spoken phrase')
assert.equal(guidedDemoSnapshot().completed,0,'No cue without actual recognized phrase')
cueGuidedDemoPhrase('guide-1',motionSteps[0].speech)
assert.equal(guidedDemoSnapshot().completed,2)
assert.equal(avatarPresenceSnapshot().motion?.id,motionSteps[0].motionId)
assert.equal(avatarPresenceSnapshot().view,'body-vrm')
const firstExpression=faceSteps[0]
cueGuidedDemoPhrase('guide-1',firstExpression.speech)
assert.equal(avatarPresenceSnapshot().view,'head-vrm')
assert.equal(currentGuidedFaceExpression(),'joy')
assert.equal(avatarPresenceSnapshot().motion?.kind,'auto')
cueGuidedDemoPhrase('guide-1',faceSteps[1].speech)
assert.equal(currentGuidedFaceExpression(),'sorrow')
cueGuidedDemoPhrase('guide-1',faceSteps[2].speech)
assert.equal(currentGuidedFaceExpression(),'angry')
cueGuidedDemoPhrase('guide-1',faceSteps[3].speech)
assert.equal(currentGuidedFaceExpression(),'fun')
cueGuidedDemoPhrase('guide-1',faceSteps[4].speech)
assert.equal(currentGuidedFaceExpression(),'neutral')
endGuidedDemo('wrong-turn')
assert.equal(guidedDemoSnapshot().active,true)
endGuidedDemo('guide-1')
assert.equal(guidedDemoSnapshot().active,false)
assert.equal(currentGuidedFaceExpression(),null)
assert.equal(avatarPresenceSnapshot().view,'head-vrm')
beginGuidedDemo('guide-2')
cueGuidedDemoPhrase('guide-2',motionSteps[2].speech)
cancelGuidedDemo()
assert.equal(guidedDemoSnapshot().active,false)
assert.equal(avatarPresenceSnapshot().view,'head-vrm')
setLumiaAvatarView(before)

portalSpeechStart('tts-one')
portalSpeechPhrase('tts-one','Esta es mi expresión facial de alegría.')
const snapshot=portalSpeechSnapshot()
assert.equal(snapshot.turnId,'tts-one')
assert.match(snapshot.phrase,/alegría/)
assert.ok(snapshot.phraseStartedAt>0)
portalSpeechEnd('tts-one')
assert.equal(portalSpeechSnapshot().turnId,null)
assert.equal(portalSpeechSnapshot().phrase,'')

const app=read('src/App.tsx')
const head=read('src/scene/LumiaPortalHead.tsx')
const speech=read('src/scene/lumia-head/portal-speech-events.ts')
const ui=read('src/ui/LumiaDemoIndicator.tsx')
assert.match(app,/avatarAction\?\.kind === 'demo'/)
assert.match(app,/await checkGuidedDemoAssets\(\)/)
assert.match(app,/if \(stale\(\)\) return ''/)
assert.match(app,/beginGuidedDemo\(turnId\)/)
assert.match(app,/cueGuidedDemoPhrase\(turnId, phrase\.text\)/)
assert.match(app,/endGuidedDemo\(turnId\)/)
assert.match(app,/cancelGuidedDemo\(\)/)
assert.match(app,/portalSpeechPhrase\(turnId, phrase\.text\)/)
assert.match(app,/goDormant\(\)/)
assert.match(head,/currentGuidedFaceExpression\(\)/)
assert.match(head,/rig\.expressions\.has\(demoExpression\)/)
assert.match(head,/portalSpeechSnapshot\(\)/)
assert.match(head,/setHeadExpressions\(rig, values\)/)
assert.match(speech,/currentPhraseStartedAt/)
assert.match(ui,/onClick=\{onStop\}/)
assert.match(ui,/Detener/)
console.log('PH-04.5 PASS: 17 audio-cued original FBX, 5 VRM facial states, safe preflight, guarded voice and interruptions, restore view/visemes')
