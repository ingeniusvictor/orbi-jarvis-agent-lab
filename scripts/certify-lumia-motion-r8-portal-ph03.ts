import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {BodyMotionCore} from '../src/scene/lumia-motion-r8/body-motion-core.js'
import {BodyPresenceCore} from '../src/scene/lumia-motion-r8/body-presence.js'
import {SemanticMotionCore} from '../src/scene/lumia-motion-r8/semantic-motion.js'
import {MotionIntelligence} from '../src/scene/lumia-motion-r8/motion-intelligence.js'
import {animationLibrary} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {
  R8BodyCompanion,portalMotionState,isR8BodyMode,isR8ClipEnabled,
} from '../src/scene/lumia-motion-r8/portal-body-companion'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const manifest=JSON.parse(read('scripts/lumia-motion-r8-private-clips-manifest.json'))
assert.equal(Object.keys(manifest.clips).length,17)
assert.equal(Object.keys(animationLibrary).length,17)
for(const [name,item] of Object.entries(manifest.clips) as Array<[string,{bytes:number;sha256:string}]>){
  assert.ok(item.bytes>0&&/^[a-f0-9]{64}$/.test(item.sha256),'Manifest verified '+name)
  assert.ok(Object.values(animationLibrary).some((s:any)=>s.file===name&&
    s.path.startsWith('/models/lumia-motion/clips/')),'All 17 R8 files local '+name)
}
assert.equal(portalMotionState('thinking',false),'thinking')
assert.equal(portalMotionState('thinking',true),'speaking')
assert.equal(portalMotionState('speaking',false),'idle','Text generation alone does not trigger body speaking')
assert.equal(portalMotionState('listening',false),'listening')
assert.equal(isR8BodyMode('?lumiaAvatar=head-vrm'),false)
assert.equal(isR8BodyMode('?lumiaAvatar=bust-vrm'),true)
assert.equal(isR8BodyMode('?lumiaAvatar=body-vrm'),true)
assert.equal(isR8BodyMode('?lumiaAvatar=head-vrm&lumiaNeck=1'),true)
assert.equal(isR8ClipEnabled('?lumiaAvatar=body-vrm&lumiaR8=procedural'),false)
assert.equal(isR8ClipEnabled('?lumiaAvatar=body-vrm'),true)
assert.equal(isR8ClipEnabled('?lumiaAvatar=head-vrm'),false)

const body=new BodyMotionCore()
const presence=new BodyPresenceCore()
for(let i=0;i<60;i++) {
  body.step(.05,{behavior:'idle',bodyPose:'natural'})
  presence.step(.05,{behavior:'idle',bodyPose:'natural'})
}
const natural=body.step(.02,{behavior:'idle',bodyPose:'natural'})
assert.ok(natural.leftUpperArmZ>.75)
assert.ok(natural.rightUpperArmZ<-.75)
assert.ok(natural.leftUpperArmZ<1.5,'Joint range is bounded')
assert.ok(natural.rightUpperArmZ>-1.5,'Joint range is bounded')
const talk=body.step(.04,{behavior:'speaking',bodyPose:'natural'})
assert.ok(Number.isFinite(talk.rightHandY),'R8 moving hand has bounded values')
const sem=new SemanticMotionCore()
assert.ok(sem.begin('Hola, primero voy a explicarte').length>0)
const semantic=sem.step(.75,{speaking:true})
assert.ok('head' in semantic && 'body' in semantic)
const intelligence=new MotionIntelligence()
intelligence.observe('idle',0)
assert.ok(intelligence.decide({now:1.4,state:'idle',active:false})?.id==='idle')
assert.equal(intelligence.decide({now:1.5,state:'idle',activeId:'idle',active:true}),null)

// Test real controller animation of a mock original VRM rig WITHOUT any VRM/FBX
// binaries. The app must create an immediate natural body posture offline.
const scene=new THREE.Group()
const bones=new Map<string,THREE.Object3D>()
for(const name of [
  'hips','spine','chest','leftShoulder','rightShoulder',
  'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm',
  'leftHand','rightHand','head','neck',
]){
  const n=new THREE.Bone()
  n.name=name
  scene.add(n)
  bones.set(name,n)
}
const fakeRig={scene,bodyBones:bones}
const companion=new R8BodyCompanion(fakeRig as any,{allowClips:false})
assert.equal(companion.clipCount,17)
assert.ok(companion.boneCount>=11)
const l=bones.get('leftUpperArm')!
const r=bones.get('rightUpperArm')!
assert.ok(Math.abs(l.quaternion.z)>.15 && Math.abs(r.quaternion.z)>.15,
  'No T-pose flash: natural upper arms before first frame')
assert.equal(companion.clipStatus.active,null)
companion.onSpokenPhrase('Hola. Primero te explico las funciones.')
for(let i=0;i<120;i++)companion.step(.016,'speaking',true)
assert.equal(companion.clipStatus.pending,null,'No private FBX requested by procedural mode')
companion.onSpeechEnd()
const x=companion.step(.016,'listening',false)
assert.ok(Number.isFinite(x.head.pitch),'Semantic motion returns bounded head cues')
companion.dispose()

const renderer=read('src/scene/LumiaPortalHead.tsx')
const sceneCode=read('src/scene/Scene.tsx')
const adapter=read('src/scene/lumia-head/vrm0-head.ts')
const gitignore=read('.gitignore')
const launcher=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(renderer,/new R8BodyCompanion\(rig/)
assert.match(renderer,/body\?\.step\(dt, phase, speakingAudio\)/)
assert.match(renderer,/body\?\.onSpokenPhrase\(data\.text\)/)
assert.match(renderer,/body\?\.onSpeechEnd\(\)/)
assert.match(renderer,/setHeadExpressions\(rig, values\)/,'Do not alter certified visemes')
assert.match(sceneCode,/queryAvatarMode === 'body-vrm'/)
assert.match(sceneCode,/queryAvatarMode === 'bust-vrm'/)
assert.match(sceneCode,/HeadVrmErrorBoundary/)
assert.match(adapter,/Boolean\(options\.showBody\)/)
assert.match(gitignore,/public\/models\/lumia-motion\/clips\//)
assert.match(launcher,/ORBIA_LUMIA_SKILL_REGISTRY=1/)
assert.match(read('scripts/INSTALAR_LUMIA_MOTION_R8_BODY.ps1'),/Get-FileHash/)
console.log('PH-03 PASS: R8 original procedural arm pose, 17 private clips, speech gating, semantic motion and fallback')
