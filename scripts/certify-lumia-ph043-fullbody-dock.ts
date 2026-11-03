import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {R8BodyCompanion} from '../src/scene/lumia-motion-r8/portal-body-companion'
import {R8_POSE_LIMITS,R8_FULL_BODY_LIMITS,boundR8BodyPose} from '../src/scene/lumia-motion-r8/pose-guard-ph042'

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const lower=['leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg',
'leftFoot','rightFoot','leftToes','rightToes']
for(const name of lower)assert.ok(Object.hasOwn(R8_FULL_BODY_LIMITS,name),
 'Full body must constrain leg joint '+name)
assert.ok(!Object.hasOwn(R8_POSE_LIMITS,'leftUpperLeg'),
 'Existing middle body envelope must not change')
for(const name of ['leftUpperArm','rightUpperArm','hips','chest','spine']){
 const full=R8_FULL_BODY_LIMITS[name as keyof typeof R8_FULL_BODY_LIMITS]
 const bust=R8_POSE_LIMITS[name as keyof typeof R8_POSE_LIMITS]
 assert.ok(full[0]<bust[0],'Full-body automatic motion must be calmer: '+name)
}
const scene=new THREE.Group()
const bones=new Map<string,THREE.Object3D>()
const origin=new Map<string,THREE.Quaternion>()
for(const name of [
 'hips','spine','chest','upperChest','leftShoulder','rightShoulder',
 'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm',
 'leftHand','rightHand',...lower]){
 const bone=new THREE.Bone();bone.name=name
 scene.add(bone);bones.set(name,bone);origin.set(name,bone.quaternion.clone())
}
const companion=new R8BodyCompanion({scene,bodyBones:bones} as any,
 {allowClips:false,fullBodySafe:true,safePose:true})
const leg=bones.get('leftLowerLeg')!
leg.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),2.1)
companion.step(.016,'idle',false)
assert.ok(leg.quaternion.angleTo(origin.get('leftLowerLeg')!)<1e-6,
 'Full-body step must clear stale knee pose on the next frame')
companion.dispose()
for(const name of lower)bones.get(name)!.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),2.3)
let capped=boundR8BodyPose(bones,origin,false,true)
assert.ok(capped>=lower.length)
for(const name of lower) {
 const limit=R8_FULL_BODY_LIMITS[name as keyof typeof R8_FULL_BODY_LIMITS][0]
 assert.ok(origin.get(name)!.angleTo(bones.get(name)!.quaternion)<limit+1e-5)
}
for(const name of lower)bones.get(name)!.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),2.3)
capped=boundR8BodyPose(bones,origin,true,true)
assert.ok(capped>=lower.length)
for(const name of lower) {
 const limit=R8_FULL_BODY_LIMITS[name as keyof typeof R8_FULL_BODY_LIMITS][1]
 assert.ok(origin.get(name)!.angleTo(bones.get(name)!.quaternion)<limit+1e-5)
}
// Bound core remains opt-in to full body; original PH-04.2 bust guard intact.
const upper=bones.get('leftUpperArm')!
upper.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),2.3)
boundR8BodyPose(bones,origin,false)
assert.ok(origin.get('leftUpperArm')!.angleTo(upper.quaternion)<=R8_POSE_LIMITS.leftUpperArm[0]+1e-5)

const composer=read('src/ui/LumiaComposer.tsx')
const app=read('src/App.tsx')
const dock=read('src/ui/LumiaViewDock.tsx')
const css=read('src/index.css')
const portal=read('src/scene/LumiaPortalHead.tsx')
const body=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
assert.match(composer,/<LumiaViewDock \/>/)
assert.match(composer,/avatarViewControl &&/)
assert.match(app,/avatarViewControl=\{AVATAR_PH04_ENABLED\}/)
assert.doesNotMatch(app,/<LumiaViewDock \/>/,'Do not leave top-right floating view selector')
assert.match(dock,/className="lumia-avatar-view-picker"/)
assert.match(dock,/aria-label=\{'Cambiar vista del avatar/)
assert.match(dock,/aria-expanded=\{open\}/)
assert.match(dock,/onClick=\{\(\) => setLumiaAvatarView\(item\.key\)\}/)
assert.match(dock,/key: 'head-vrm'/)
assert.match(dock,/key: 'bust-vrm'/)
assert.match(dock,/key: 'body-vrm'/)
assert.match(css,/\.lumia-avatar-view-options \{[\s\S]+bottom: calc\(100% \+ 17px\)/)
assert.match(css,/\.lumia-avatar-view-picker \{[\s\S]+position: relative/)
assert.match(portal,/fullBodySafe: fullBody/)
assert.match(portal,/safePose = new URLSearchParams/)
assert.match(body,/if \(this\.fullBodySafe && this\.safePose\)/)
assert.match(body,/boundR8BodyPose\(this\.rig\.bodyBones, this\.proceduralBase,/)
assert.match(portal,/setHeadExpressions\(rig, values\)/)
console.log('PH-04.3 PASS: full-body knee/ankle restoration and tighter R8 safe envelope, preserved bust, composer avatar view picker')
