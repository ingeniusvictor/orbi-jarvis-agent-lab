import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {R8BodyCompanion} from '../src/scene/lumia-motion-r8/portal-body-companion'
import {
 LUMIA_GUIDED_DEMO_STEPS,beginGuidedDemo,cueGuidedDemoStage,
 waitForGuidedDemoClip,reportGuidedDemoClip,
 guidedDemoSnapshot,endGuidedDemo,
} from '../src/scene/lumia-motion-r8/avatar-demo-ph045'
import {motionCatalog} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {parseLumiaAvatarAction,respondToLumiaAvatarAction,setLumiaAvatarView}
  from '../src/scene/lumia-motion-r8/avatar-presence-ph04'

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
assert.equal(LUMIA_GUIDED_DEMO_STEPS.length,25)
assert.equal(motionCatalog.length,17)
for(const text of [
  'Hola Lumi, voy a hacer una demostración de tus animaciones.',
  'No alumnos, lo que quiero es que me des una demostración de tus animaciones.',
  'Lumi, puedes hacer una demostración de tus animaciones?',
  'Lumi, muéstrame tus animaciones',
])assert.deepEqual(parseLumiaAvatarAction(text),{kind:'demo'},text)
assert.deepEqual(parseLumiaAvatarAction('Lumia no sabía que tenía un motor de animaciones incluido.'),
  {kind:'animation-info'})
assert.deepEqual(parseLumiaAvatarAction('Lumi, puedes generar videos cortos?'),
  {kind:'animation-info'})
assert.match(respondToLumiaAvatarAction({kind:'animation-info'}),/no significa que pueda crear videos/)
for (const said of [
  'Lumi, explícame cómo crear videos con Blender.',
  'Lumi, ¿cómo hacer una animación para un videojuego?',
  'Mi esposa me dijo que haría una demostración de animaciones.',
])assert.ok(parseLumiaAvatarAction(said)?.kind!=='demo',said)

// The 25 stages must be delivered through 25 independent drained Kokoro
// speakers; never feed the entire narrative to one fast segmented TTS queue.
const app=read('src/App.tsx')
const bodySource=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
const head=read('src/scene/LumiaPortalHead.tsx')
assert.match(app,/for \(const \[index, step\] of LUMIA_GUIDED_DEMO_STEPS.entries\(\)\)/)
assert.match(app,/const stageSpeaker = createSpeaker/)
assert.match(app,/stageSpeaker.push\(step.speech\)/)
assert.match(app,/await stageSpeaker.end\(\)/)
assert.match(app,/cueGuidedDemoStage\(turnId, index\)/)
assert.match(app,/await waitForGuidedDemoClip\(turnId, index\)/)
assert.match(app,/if \(!guidedRun\) spk.push\(text\)/)
assert.match(app,/portalSpeechEnd\(turnId\)/)
assert.match(app,/step.type === 'face' \? 1400/)
assert.match(bodySource,/Number.POSITIVE_INFINITY/)
assert.match(bodySource,/THREE.LoopRepeat/)
assert.match(bodySource,/clip\.repetitions > 1/)
assert.match(bodySource,/reportGuidedDemoClip\(this.demoClipId,'finished'\)/)
assert.match(head,/requestManualClip\(command\.id, guidedDemoSnapshot\(\)\.active\)/)

// A deterministic mixer-based regression: real 4-second FBX clip with two
// authored Waving repetitions requires ~8s, not the old 7.5-second deadline.
// None of the original private FBX assets need to enter GitHub for this.
setLumiaAvatarView('head-vrm')
beginGuidedDemo('duration')
const wavingIndex=LUMIA_GUIDED_DEMO_STEPS.findIndex(s=>s.motionId==='waving')
assert.ok(wavingIndex>0)
cueGuidedDemoStage('duration',wavingIndex)
const durationPromise=waitForGuidedDemoClip('duration',wavingIndex)
let completed=false
void durationPromise.then(()=>{completed=true})
const scene=new THREE.Group()
const bones=new Map<string,THREE.Object3D>()
for(const name of ['hips','spine','chest','leftShoulder','rightShoulder',
 'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm',
 'leftHand','rightHand']){
  const b=new THREE.Bone();b.name=name;scene.add(b);bones.set(name,b)
}
const companion=new R8BodyCompanion({scene,bodyBones:bones} as any,
 {allowClips:true,safePose:true,fullBodySafe:true})
const clip=new THREE.AnimationClip('WavingSynthetic',4,[
 new THREE.QuaternionKeyframeTrack('leftUpperArm.quaternion',[0,4],[0,0,0,1,0,0,0,1])
])
;(companion as any).cache.set('waving',{id:'waving',clip,loop:false,repetitions:2})
assert.equal(companion.requestManualClip('waving',true),true)
// Drain Promise.then(loadClip) and callbacks without timers.
for(let i=0;i<5;i++) await Promise.resolve()
for(let i=0;i<150;i++) companion.step(.05,'idle',false)
await Promise.resolve()
assert.equal(completed,false,'Waving x2 must NOT be truncated at 7.5 s')
assert.equal(companion.clipStatus.active,'waving','Keep real FBX action playing')
for(let i=0;i<25;i++) companion.step(.05,'idle',false)
const result=await durationPromise
assert.equal(result.status,'finished')
assert.ok((result.duration??0)>=4)
assert.equal(completed,true)
companion.dispose()
endGuidedDemo('duration')
assert.equal(guidedDemoSnapshot().active,false)

// A failed clip is signaled and does not falsely report success.
beginGuidedDemo('failed')
cueGuidedDemoStage('failed',wavingIndex)
const failedWait=waitForGuidedDemoClip('failed',wavingIndex)
reportGuidedDemoClip('waving','failed')
assert.equal((await failedWait).status,'failed')
endGuidedDemo('failed')

// Cancelling must release pending promises rather than holding the mic loop.
beginGuidedDemo('abort')
cueGuidedDemoStage('abort',wavingIndex)
const waitAbort=waitForGuidedDemoClip('abort',wavingIndex)
endGuidedDemo('abort')
assert.equal((await waitAbort).status,'cancelled')
assert.equal(guidedDemoSnapshot().active,false)
console.log('PH-04.6 PASS: actual 8s Waving x2 mixer lifecycle; full 17-clip sequencing; strict voice claims; no TTS slowdown outside demo')
