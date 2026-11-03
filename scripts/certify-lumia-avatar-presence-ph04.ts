import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {motionCatalog} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {
  parseLumiaAvatarAction, resolveAvatarView,
  avatarViewLabel, avatarPresenceSnapshot, subscribeAvatarPresence,
  setLumiaAvatarView, requestLumiaAvatarMotion, resumeLumiaAvatarMotion,
  respondToLumiaAvatarAction,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {R8BodyCompanion} from '../src/scene/lumia-motion-r8/portal-body-companion'
import * as THREE from 'three'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
assert.equal(motionCatalog.length,17)
assert.equal(resolveAvatarView('',true),'bust-vrm','PH-04 native view MUST be middle body')
assert.equal(resolveAvatarView('',false),'legacy','No opt-in means no visual behavior change')
for(const view of ['head-vrm','bust-vrm','body-vrm','legacy'] as const) {
  assert.equal(resolveAvatarView('?lumiaAvatar='+view,true),view)
}
assert.equal(resolveAvatarView('?lumiaAvatar=invalid',true),'bust-vrm')
assert.equal(avatarViewLabel('bust-vrm'),'medio cuerpo')

const viewCommands:Array<[string,string]> = [
  ['Lumi, cambia a la vista solo rostro','head-vrm'],
  ['Lumi cambia a cuerpo completo','body-vrm'],
  ['Lumi, vuelve a la vista principal','bust-vrm'],
  ['Lumi, ponte en medio cuerpo','bust-vrm'],
  ['Muéstrate de cuerpo completo','body-vrm'],
  ['Lumi, cambia a solo la cara','head-vrm'],
]
for(const [said,expected] of viewCommands) {
  assert.deepEqual(parseLumiaAvatarAction(said),{kind:'view',view:expected},said)
}
const gestureCommands:Array<[string,string]> = [
  ['Lumi, haz un saludo','waving'],
  ['Lumi, salúdame','waving'],
  ['Lumi, aplaude','clapping'],
  ['Lumi, señala algo','pointinggesture'],
  ['Lumi, haz un gesto de negación','no'],
  ['Lumi, haz un gesto de pensar','thinking'],
  ['Lumi, muéstrame un gesto de alegría','happy'],
  ['Lumi, haz un gesto de sorpresa','surprised'],
]
for(const [said,id] of gestureCommands) {
  assert.deepEqual(parseLumiaAvatarAction(said),{kind:'motion',id},said)
  assert.ok(motionCatalog.some(c=>c.id===id),'Only catalog-backed actions may play')
}
assert.deepEqual(parseLumiaAvatarAction('Lumi, vuelve al modo natural'),{kind:'auto'})
assert.deepEqual(parseLumiaAvatarAction('Lumi, ¿qué vistas tienes?'),{kind:'list-views'})
assert.deepEqual(parseLumiaAvatarAction('Lumi, ¿cuáles son tus animaciones disponibles?'),{kind:'list-motions'})
assert.deepEqual(parseLumiaAvatarAction('Lumi, ¿qué cuerpo virtual tienes?'),{kind:'describe'})
for(const unrelated of [
  'Lumi, cómo estás','Lumi, dime el clima de mañana',
  'Traduce esto a inglés','Abre mi navegador',
  'Borra archivos de mi computadora',
  'Mi amigo me dijo que cambie de vista',
  'Cómo hago un saludo en otro idioma',
  'Me gustaría que me expliques las animaciones de videojuegos',
  '¿Puedes acceder a mi cuenta?',
  'Recuerda que dije saludar a María',
]) {
  assert.equal(parseLumiaAvatarAction(unrelated),null,'No command hijack: '+unrelated)
}

let notifications=0
const off=subscribeAvatarPresence(()=>{notifications++})
assert.ok(setLumiaAvatarView('head-vrm'))
assert.equal(avatarPresenceSnapshot().view,'head-vrm')
assert.ok(requestLumiaAvatarMotion('waving'))
const afterWaving=avatarPresenceSnapshot()
assert.equal(afterWaving.view,'bust-vrm','Showing a hand gesture automatically reveals bust')
assert.equal(afterWaving.motion?.id,'waving')
assert.ok(afterWaving.motion?.sentAt)
assert.equal(requestLumiaAvatarMotion('unknown-command'),false)
resumeLumiaAvatarMotion()
assert.equal(avatarPresenceSnapshot().motion?.kind,'auto')
assert.equal(avatarPresenceSnapshot().motion?.id,null)
assert.ok(notifications>=3)
off()
assert.match(respondToLumiaAvatarAction({kind:'list-views'}),/tres vistas/i)
assert.match(respondToLumiaAvatarAction({kind:'list-motions'}),/diecisiete animaciones/i)
assert.match(respondToLumiaAvatarAction({kind:'describe'}),/avatar virtual/i)
assert.match(respondToLumiaAvatarAction({kind:'motion',id:'waving'}),/voy a intentar/i)
assert.match(respondToLumiaAvatarAction({kind:'auto'}),/modo de movimientos automáticos/i)

// Manual motion cannot execute with disabled FBX playback. Procedural fallback
// must still be valid for a mock rig in a clean CI without user's private VRM.
const skeleton=new THREE.Group()
const joints=new Map<string,THREE.Object3D>()
for(const name of [
  'hips','spine','chest','leftShoulder','rightShoulder','leftUpperArm',
  'rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand',
]) {const bone=new THREE.Bone();bone.name=name;skeleton.add(bone);joints.set(name,bone)}
const companion=new R8BodyCompanion({scene:skeleton,bodyBones:joints} as any,{allowClips:false})
assert.equal(companion.requestManualClip('waving'),false)
companion.resumeAutomatic()
for(let i=0;i<10;i++) companion.step(.016,'idle',false)
assert.ok(Number.isFinite(joints.get('leftUpperArm')!.quaternion.z))
companion.dispose()

const app=read('src/App.tsx')
const scene=read('src/scene/Scene.tsx')
const head=read('src/scene/LumiaPortalHead.tsx')
const avatar=read('src/scene/lumia-motion-r8/avatar-presence-ph04.ts')
const body=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
const launch=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const skill=read('bridge/orbia/skill-registry-skill01.mjs')
assert.match(app,/const avatarAction = AVATAR_PH04_ENABLED && !image/)
assert.match(app,/respondToLumiaAvatarAction\(avatarAction\)/)
assert.match(app,/portalSpeechStart\(turnId\)/)
assert.match(app,/portalSpeechEnd\(turnId\)/)
assert.match(scene,/subscribeAvatarPresence/)
assert.match(scene,/LumiaPortalHead key=\{avatarView\}/)
assert.match(scene,/headEnabled/)
assert.match(head,/centerY = fullBody \? 0\.99 : bust \? 1\.50/)
assert.match(head,/fraction = fullBody \? \.84 : bust \? \.82/)
assert.match(head,/body\.requestManualClip\(command\.id\)/)
assert.match(head,/body\.resumeAutomatic\(\)/)
assert.match(head,/setHeadExpressions\(rig, values\)/)
assert.match(head,/body\?\.onSpokenPhrase\(data\.text\)/)
assert.match(body,/this\.elapsed>=this\.manualUntil/)
assert.match(avatar,/window\.history\.replaceState/)
assert.doesNotMatch(avatar,/window\.location\.reload\(/)
assert.match(launch,/VITE_LUMIA_AVATAR_PH04=1/)
assert.match(launch,/ORBIA_LUMIA_AVATAR_PH04=1/)
assert.match(launch,/JARVIS_ALLOW_WRITES=0/)
assert.match(skill,/entry\('avatar-presence'/)
console.log('PH-04 PASS: native bust, three reversible views, authorized voice actions, 17 catalog motions, no OS/reload, intact lip sync')
