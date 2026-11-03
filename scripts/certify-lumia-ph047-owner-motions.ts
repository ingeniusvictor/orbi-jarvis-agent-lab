import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {motionCatalog} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {
  parseLumiaAvatarAction,avatarPresenceSnapshot,
  setLumiaAvatarView,requestLumiaAvatarMotion,resumeLumiaAvatarMotion,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {
  R8_FULL_BODY_LIMITS,R8_AUTHORED_GESTURE_LIMITS,boundR8BodyPose,
} from '../src/scene/lumia-motion-r8/pose-guard-ph042'
import {R8BodyCompanion} from '../src/scene/lumia-motion-r8/portal-body-companion'
import {mixamoBoneName} from '../src/scene/lumia-motion-r8/mixamo-retarget.js'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
assert.equal(motionCatalog.length,17)
assert.equal(new Set(motionCatalog.map(x=>x.id)).size,17)

// Exact ASUS Whisper transcripts, 3 Nov 2026, 17:27–17:39.
// Every phrase refers to real owner-installed FBX, never synthetic HTML/CSS.
const clap=[
 'Muestramiento animación de aplaudir.',
 'No lo mismo, lo que quiero es que me muestres la animación que tienes tú de aplaudir.',
 'Lumi, quiero ver tu animación de aplaudir.',
 'Lumi, ¿puedes mostrarme tu animación de aplaudir?',
 'Lumi, muéstrame la animación de aplaudir.',
 'Lumi, haz la animación de aplaudir.',
 'Lumi, aplaude.',
]
for(const said of clap)assert.deepEqual(
 parseLumiaAvatarAction(said),{kind:'motion',id:'clapping'},said)
for(const said of [
 'Mi quiero que me des una demostración de tus animaciones.',
 'No lo mío lo que quiero es que me des una demostración de tus animaciones.',
])assert.deepEqual(parseLumiaAvatarAction(said),{kind:'demo'},said)
for(const said of [
 'Lumi, quiero ver tu animación de negar.',
 'Lumi, muéstrame la animación de decir que no.',
 'Lumi, ejecuta animación no.',
])assert.deepEqual(parseLumiaAvatarAction(said),{kind:'motion',id:'no'},said)
for(const said of [
 '¿Cómo puedo hacer una animación de aplaudir con Blender?',
 'Mi hijo quiere ver una animación de aplaudir en internet.',
 '¿Puedes programar en CSS un ejemplo de animación de aplaudir?',
 'Lumi no aplaudas todavía.',
])assert.ok(parseLumiaAvatarAction(said)?.kind!=='motion',
 'Avoid unintended playback: '+said)

// The menu and voice MUST share one catalog, never 17 hand-maintained commands.
const dock=read('src/ui/LumiaMotionDock.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const css=read('src/index.css')
const presence=read('src/scene/lumia-motion-r8/avatar-presence-ph04.ts')
const body=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
const portal=read('src/scene/LumiaPortalHead.tsx')
assert.match(dock,/motionCatalog\.filter\(clip => clip\.category === group\.id\)/)
assert.match(dock,/requestLumiaAvatarMotion\(id\)/)
assert.match(dock,/resumeLumiaAvatarMotion\(\)/)
assert.match(dock,/onDemo\(\)/)
assert.match(dock,/aria-label="Abrir catálogo de 17 animaciones Motion R8"/)
assert.match(dock,/disabled=\{busy\}/)
assert.match(dock,/id: 'conversacion'/)
assert.match(dock,/id: 'emociones'/)
assert.match(dock,/id: 'movimiento'/)
assert.match(dock,/lumiaR8'\) === 'procedural'/)
assert.match(css,/\.lumia-motion-menu-scroll[\s\S]+max-height: min\(48vh,380px\)/)
const viewIndex=composer.indexOf('{avatarViewControl && <LumiaViewDock />}')
const motionIndex=composer.indexOf('{avatarViewControl && <LumiaMotionDock')
const imageIndex=composer.indexOf("className={'lumia-composer-icon-button lumia-composer-attach'")
const textIndex=composer.indexOf('className="lumia-composer-text"')
assert.ok(viewIndex>0 && viewIndex<motionIndex && motionIndex<imageIndex &&
 imageIndex<textIndex,'Second-left motion picker BEFORE image, text and voice')
assert.equal(composer.split('<LumiaMotionDock').length,2,
 'Exactly one manual motion picker; no duplicate toolbar')
assert.match(composer,/onSend\('Lumi, puedes hacer una demostración de tus animaciones'\)/)
setLumiaAvatarView('head-vrm')
assert.equal(requestLumiaAvatarMotion('waving'),true)
assert.equal(avatarPresenceSnapshot().view,'bust-vrm')
setLumiaAvatarView('head-vrm')
assert.equal(requestLumiaAvatarMotion('walking'),true)
assert.equal(avatarPresenceSnapshot().view,'body-vrm')
assert.equal(requestLumiaAvatarMotion('nonexistent'),false)
resumeLumiaAvatarMotion()
setLumiaAvatarView('head-vrm')

// PH-04.2 full body safety remains intact for 15 clips. Widen only
// selected clapping arm joints when an explicit manual gesture is active.
for(const name of ['leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm']){
 assert.ok(
  R8_AUTHORED_GESTURE_LIMITS.clapping[name][1] >
  R8_FULL_BODY_LIMITS[name][1],
  'Clapping should allow palm approach: '+name)
}
const bones=new Map<string,THREE.Object3D>()
const bases=new Map<string,THREE.Quaternion>()
for(const name of ['leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm']){
 const bone=new THREE.Bone();bones.set(name,bone)
 bases.set(name,bone.quaternion.clone())
 bone.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),1.45)
}
boundR8BodyPose(bones,bases,true,true,'clapping')
assert.ok(bases.get('leftUpperArm')!.angleTo(
 bones.get('leftUpperArm')!.quaternion)>1.4,'Clapping can cross original arm clamp')
for(const bone of bones.values()){
 bone.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),1.45)
}
boundR8BodyPose(bones,bases,true,true,'waving')
assert.ok(bases.get('leftUpperArm')!.angleTo(
 bones.get('leftUpperArm')!.quaternion)<=R8_FULL_BODY_LIMITS.leftUpperArm[1]+1e-5,
 'Other clips retain safe arm limits')
assert.equal(mixamoBoneName('mixamorig:Head'),'head')
assert.equal(mixamoBoneName('mixamorig:Neck'),'neck')
assert.equal(mixamoBoneName('mixamorigHead'),'head')
assert.equal(mixamoBoneName('J_Bip_C_Head'),'head')
assert.match(body,/includeHead:id==='no'/)
assert.match(body,/get authoredNoHeadActive\(\)/)
assert.match(portal,/const authoredNoHead = body\?\.authoredNoHeadActive/)
assert.match(portal,/if \(!authoredNoHead\)/)

// Real THREE.AnimationMixer test: Clapping 4s × 3 authored repetitions = 12s,
// and an owner request must not be cut after the old 7.5-second timer.
const scene=new THREE.Group()
const rigBones=new Map<string,THREE.Object3D>()
for(const name of ['hips','spine','chest','upperChest','head','neck',
 'leftShoulder','rightShoulder','leftUpperArm','rightUpperArm',
 'leftLowerArm','rightLowerArm','leftHand','rightHand']){
 const bone=new THREE.Bone();bone.name=name;scene.add(bone);rigBones.set(name,bone)
}
const companion=new R8BodyCompanion({scene,bodyBones:rigBones} as any,
 {allowClips:true,safePose:true,fullBodySafe:true})
for(const entry of motionCatalog) {
  if(entry.id!=='clapping' && entry.id!=='no')
    (companion as any).failed.add(entry.id)
}
// This synthetic CI test must not attempt browser FBX network requests.
const clapping=new THREE.AnimationClip('ClappingSynthetic',4,[
 new THREE.QuaternionKeyframeTrack('leftUpperArm.quaternion',
  [0,4],[0,0,0,1,0,0,0,1]),
])
;(companion as any).cache.set('clapping',
 {id:'clapping',clip:clapping,loop:false,repetitions:3,headAuthored:false})
assert.equal(companion.requestManualClip('clapping'),true)
for(let i=0;i<5;i++)await Promise.resolve()
for(let i=0;i<170;i++) companion.step(.05,'idle',false)
assert.equal(companion.clipStatus.active,'clapping',
 'Manual clapping 3 repetitions must keep playing after 8.5 seconds')
for(let i=0;i<82;i++) companion.step(.05,'idle',false)
assert.equal(companion.clipStatus.active,null,'Clapping must finish automatically')
assert.ok(companion.clappingHandDistance===null||
 companion.clappingHandDistance>=0)

const noClip=new THREE.AnimationClip('NoSynthetic',2,[
 new THREE.QuaternionKeyframeTrack('head.quaternion',
  [0,2],[0,0,0,1,0,0,0,1]),
 new THREE.QuaternionKeyframeTrack('leftUpperArm.quaternion',
  [0,2],[0,0,0,1,0,0,0,1]),
])
;(companion as any).cache.set('no',
 {id:'no',clip:noClip,loop:false,repetitions:1,headAuthored:true})
assert.equal(companion.requestManualClip('no'),true)
for(let i=0;i<5;i++)await Promise.resolve()
assert.equal(companion.authoredNoHeadActive,true,
 'Authored No head track must temporarily override pointer tracking')
for(let i=0;i<46;i++) companion.step(.05,'idle',false)
assert.equal(companion.authoredNoHeadActive,false,
 'Head pointer control automatically restored on clip completion')
companion.dispose()
assert.match(body,/Number\.POSITIVE_INFINITY/)
assert.match(body,/clip\.repetitions > 1/)
assert.match(body,/el contacto real de las palmas requiere revisión visual ASUS/)
console.log('PH-04.7 PASS: 17-animation left menu, ASUS voice transcripts, No authored head, clapping-specific safe envelope, manual 12s FBX playback')
