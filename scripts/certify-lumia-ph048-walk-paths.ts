import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {R8BodyCompanion} from '../src/scene/lumia-motion-r8/portal-body-companion'
import {motionCatalog} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'
import {WALK_STAGE_APPROACH,WALK_STAGE_ORBIT_RADIUS,walkStageTarget,WalkStage}
 from '../src/scene/lumia-motion-r8/walk-stage-ph048'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const near=(a:number,b:number,tol=.04)=>assert.ok(Math.abs(a-b)<tol,
 'Expected '+a.toFixed(4)+' ≈ '+b.toFixed(4))
assert.deepEqual(motionCatalog.filter(c=>c.category==='movimiento').map(c=>c.id),
 ['walking','walkingforward','walkingcircle'])
assert.deepEqual(walkStageTarget('walking',.5),{x:0,z:0,yaw:0})
assert.deepEqual(walkStageTarget('clapping',.5),{x:0,z:0,yaw:0})
assert.deepEqual(walkStageTarget(null,.5),{x:0,z:0,yaw:0})
assert.deepEqual(walkStageTarget('walkingforward',Number.NaN),{x:0,z:0,yaw:0})
const towards=walkStageTarget('walkingforward',.85)
assert.ok(towards.z<-.30,'Walk forward must APPROACH camera')
near(walkStageTarget('walkingforward',1).z,-WALK_STAGE_APPROACH,.0001)
const q=walkStageTarget('walkingcircle',.25)
near(q.x,WALK_STAGE_ORBIT_RADIUS,.0001)
near(q.z,-WALK_STAGE_ORBIT_RADIUS,.0001)
near(q.yaw,-Math.PI/2,.0001)
const halfway=walkStageTarget('walkingcircle',.5)
near(halfway.x,2*WALK_STAGE_ORBIT_RADIUS,.0001)
near(halfway.z,0,.0001)
const finished=walkStageTarget('walkingcircle',1)
near(finished.x,0,.0001)
near(finished.z,0,.0001)
near(finished.yaw,-2*Math.PI,.0001)

const stage=new WalkStage()
for(let i=0;i<20;i++)stage.step(.05,'walking',i*.05,3,true)
assert.deepEqual(stage.pose,{x:0,z:0,yaw:0},'Walking in place must remain fixed')
for(let i=0;i<60;i++)stage.step(.05,'walkingforward',i*.05,4,true)
assert.ok(stage.pose.z<-.20)
const priorZ=stage.pose.z
stage.step(.05,null,0,0,true)
assert.ok(stage.pose.z>priorZ && stage.pose.z<0,'Return gradual; no teleport')
for(let i=0;i<280;i++)stage.step(.05,null,0,0,true)
near(stage.pose.z,0,.0001)
stage.reset()
for(let i=0;i<30;i++)stage.step(.05,'walkingcircle',i*.05,4,true)
assert.ok(stage.pose.x>.14,'Circle should move horizontally')
assert.ok(stage.pose.z<-.12,'Circle should move in depth')
assert.ok(Math.abs(stage.pose.yaw)>.7,'Circle must turn the actor')
stage.reset()
for(let i=0;i<30;i++)stage.step(.05,'walkingcircle',i*.05,4,false)
assert.deepEqual(stage.pose,{x:0,z:0,yaw:0},'QA rollback disables choreography')

// Actual THREE.AnimationMixer + synthetic stand-ins, private FBX not uploaded.
const scene=new THREE.Group()
const bones=new Map<string,THREE.Object3D>()
for(const name of [
 'hips','spine','chest','upperChest','leftShoulder','rightShoulder',
 'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand',
 'rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg',
 'leftFoot','rightFoot','leftToes','rightToes',
]){
 const bone=new THREE.Bone();bone.name=name;scene.add(bone);bones.set(name,bone)
}
const companion=new R8BodyCompanion({scene,bodyBones:bones} as any,{
 allowClips:true,safePose:true,fullBodySafe:true,walkStageEnabled:true,
})
for(const entry of motionCatalog){
 if(!entry.id.startsWith('walking'))(companion as any).failed.add(entry.id)
}
for(const id of ['walking','walkingforward','walkingcircle']){
 const clip=new THREE.AnimationClip(id+'Synthetic',4,[
  new THREE.QuaternionKeyframeTrack('leftUpperLeg.quaternion',[0,4],
   [0,0,0,1,0,0,0,1]),
 ])
 ;(companion as any).cache.set(id,{
  id,clip,loop:id==='walking',repetitions:1,headAuthored:false,
 })
}
assert.equal(companion.requestManualClip('walking'),true)
for(let i=0;i<8;i++)await Promise.resolve()
for(let i=0;i<35;i++)companion.step(.05,'idle',false)
near(companion.walkStagePose.x,0,.0001)
near(companion.walkStagePose.z,0,.0001)
companion.resumeAutomatic()
assert.equal(companion.requestManualClip('walkingforward'),true)
for(let i=0;i<8;i++)await Promise.resolve()
for(let i=0;i<50;i++)companion.step(.05,'idle',false)
assert.equal(companion.clipStatus.active,'walkingforward')
assert.ok(companion.walkStagePose.z<-.12,'Mixer time must drive forward stage')
for(let i=0;i<50;i++)companion.step(.05,'idle',false)
assert.equal(companion.clipStatus.active,null)
const endZ=companion.walkStagePose.z
assert.ok(endZ<0)
for(let i=0;i<70;i++)companion.step(.05,'idle',false)
assert.ok(Math.abs(companion.walkStagePose.z)<Math.abs(endZ))
assert.equal(companion.requestManualClip('walkingcircle'),true)
for(let i=0;i<8;i++)await Promise.resolve()
for(let i=0;i<25;i++)companion.step(.05,'idle',false)
assert.ok(companion.walkStagePose.x>.1,'Circle clip should follow arc')
assert.ok(companion.walkStagePose.z<-.1,'Circle clip should travel in depth')
assert.ok(Math.abs(companion.walkStagePose.yaw)>.5,'Circle clip turns')
companion.dispose()

const portal=read('src/scene/LumiaPortalHead.tsx')
const body=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
const retarget=read('src/scene/lumia-motion-r8/mixamo-retarget.js')
const sceneCode=read('src/scene/Scene.tsx')
assert.match(portal,/const walkStageEnabled = new URLSearchParams/)
assert.match(portal,/get\('lumiaWalk'\) !== 'legacy'/)
assert.match(portal,/<group ref=\{walkStageGroup\}>/)
assert.match(portal,/const path = body\?\.walkStagePose/)
assert.match(portal,/setHeadExpressions\(rig, values\)/)
assert.match(body,/this\.walkStage\.step\(dt,this\.activeId,this\.action\?\.time/)
assert.match(body,/this\.walkStageEnabled=walkStageEnabled && fullBodySafe/)
assert.match(retarget,/prop!=='quaternion'/)
assert.match(sceneCode,/state\.camera\.lookAt\(0, 0, 0\)/)
console.log('PH-04.8 PASS: 3 separate walking states, actual FBX time, stable camera, circle, recovery and rollback')
