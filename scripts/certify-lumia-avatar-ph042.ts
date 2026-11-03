import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {prepareLumiaHead} from '../src/scene/lumia-head/vrm0-head'
import {R8_POSE_LIMITS,boundR8BodyPose} from '../src/scene/lumia-motion-r8/pose-guard-ph042'
import {
 parseLumiaAvatarAction,avatarPresenceSnapshot,respondToLumiaAvatarAction,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'

const log = [
 ['Lumi, cambia la vista principal, por favor.','head-vrm'],
 ['Lumi, cambia la versión solo a rostro, por favor.','head-vrm'],
 ['Bista solo rostro.','head-vrm'],
 ['Lumia cambia a la vista de solo rostro.','head-vrm'],
 ['Ahora cambia tu presentación a cuerpo completo.','body-vrm'],
 ['Lumia, puedes cambiar a la vista principal.','head-vrm'],
 ['Lumi, necesito que cambies a la versión de cuerpo completo.','body-vrm'],
 ['Cambia a la versión solo rostro, por favor.','head-vrm'],
 ['Ahora cambia la presentación a la versión cuerpo intermedio.','bust-vrm'],
 ['Lumi cambió la vista principal a la vista de medio cuerpo.','bust-vrm'],
] as const
for(const [said,view] of log){
 assert.deepEqual(parseLumiaAvatarAction(said),{kind:'view',view},
    'Exact 2026-11-03 ASUS voice diagnostic: '+said)
}
for(const said of [
 'Lumi vuelve a la visión, a la visual original.',
 'Solo quiero probar que puedas cambiar entre la vista cuerpo completo y la vista de...',
 'Lumi cambia entre solo rostro y cuerpo completo.',
]){
 const action=parseLumiaAvatarAction(said)
 assert.ok(action && action.kind!=='view','Do not act on ambiguous intent: '+said)
}
const report='Indicaste que cambiaste a cuerpo preto, pero sigue siendo la versión de solo rostro.'
assert.deepEqual(parseLumiaAvatarAction(report),{kind:'status'})
const status=respondToLumiaAvatarAction({kind:'status'})
assert.match(status,/En esta ventana mi presentación actual es/)
assert.match(status,/No he cambiado nada/)
for(const said of [
 'Mi hijo me contó que cambió la vista del videojuego a cuerpo completo',
 'Ayer cambié la versión del programa a medio cuerpo',
 '¿Cómo cambio la vista de la cámara en Blender?',
 'Lumia no cambies a cuerpo completo',
])assert.ok(parseLumiaAvatarAction(said)?.kind!=='view','no accidental change: '+said)

const bones=new Map<string,THREE.Object3D>()
const baseline=new Map<string,THREE.Quaternion>()
for(const name of Object.keys(R8_POSE_LIMITS)){
 const bone=new THREE.Bone();bone.name=name
 bones.set(name,bone);baseline.set(name,bone.quaternion.clone())
 bone.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),2.4)
}
assert.ok(boundR8BodyPose(bones,baseline,false)>5)
for(const [name,node] of bones){
 const limit=R8_POSE_LIMITS[name as keyof typeof R8_POSE_LIMITS][0]
 assert.ok(baseline.get(name)!.angleTo(node.quaternion)<=limit+1e-5,
  'Auto FBX joint bounded: '+name)
}
for(const [name,node] of bones)node.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),2.4)
boundR8BodyPose(bones,baseline,true)
for(const [name,node] of bones){
 const limit=R8_POSE_LIMITS[name as keyof typeof R8_POSE_LIMITS][1]
 assert.ok(baseline.get(name)!.angleTo(node.quaternion)<=limit+1e-5,
  'Manual FBX joint bounded: '+name)
}
const originalScene=new THREE.Group()
const sourceHead=new THREE.Bone();sourceHead.name='Head'
originalScene.add(sourceHead)
const sourceFace=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:'#ffffff'}))
sourceFace.name='Face'
sourceHead.add(sourceFace)
const sourceHair=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:'#00ffee'}))
sourceHair.name='Hair'
sourceHead.add(sourceHair)
const assoc=new Map<THREE.Object3D,{nodes?:number;meshes?:number}>()
assoc.set(sourceHead,{nodes:0});assoc.set(sourceFace,{meshes:0});assoc.set(sourceHair,{meshes:2})
const fakeGltf={
 scene:originalScene,
 parser:{associations:assoc,json:{
  nodes:[{name:'Head'}],
  extensions:{VRM:{humanoid:{humanBones:[{bone:'head',node:0}]}}},
 }},
} as any
const first=prepareLumiaHead(fakeGltf,{ph02:true,showBody:true})
assert.notEqual(first.scene,originalScene,'No mutating cached GLTF scene')
assert.notEqual(first.head,sourceHead,'No sharing animation bones across views')
assert.ok(first.meshes.get(0)?.[0]!==sourceFace)
assert.notEqual(first.meshes.get(0)?.[0]?.material,sourceFace.material,'materials cloned for optical preset')
const initial=sourceHead.quaternion.clone()
first.head?.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),1.3)
const second=prepareLumiaHead(fakeGltf,{ph02:true})
assert.ok(sourceHead.quaternion.equals(initial),'Original bind skeleton must remain unchanged')
assert.ok(second.head?.quaternion.equals(initial),'Each new view must start from untouched bind skeleton')
assert.notEqual(second.head,first.head,'Avatar view remounts cannot share deformed bones')
assert.equal(second.meshes.get(0)?.[0]?.visible,true)
assert.equal(sourceFace.visible,true)
assert.equal(avatarPresenceSnapshot().motion,null)
const comp=readFileSync(new URL('../src/scene/lumia-motion-r8/portal-body-companion.ts',import.meta.url),'utf8')
const portal=readFileSync(new URL('../src/scene/LumiaPortalHead.tsx',import.meta.url),'utf8')
const presence=readFileSync(new URL('../src/scene/lumia-motion-r8/avatar-presence-ph04.ts',import.meta.url),'utf8')
assert.match(comp,/boundR8BodyPose/)
assert.match(portal,/safePose/)
assert.match(presence,/new BroadcastChannel\('lumia:ph04-views:v1'\)/)
assert.match(presence,/applyLumiaAvatarView\(message\.view as LumiaAvatarView, false\)/)
console.log('PH-04.2 PASS: ASUS voice intents, truthful status, cross-tab sync, cloned VRM scene and anatomical pose bounds')
