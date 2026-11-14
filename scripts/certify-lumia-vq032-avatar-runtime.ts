import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  VQ03_AVATAR_QA_ENABLED,
  angleBetweenQuaternionsDegrees,
  Vq03MotionEvidence,
  reportVq03AvatarQA,
} from '../src/scene/lumia-motion-r8/avatar-runtime-audit-vq03'
import {
  avatarPresenceSnapshot,setLumiaAvatarView,requestLumiaAvatarMotion,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'

assert.equal(VQ03_AVATAR_QA_ENABLED,false,'Production/CI must be OFF by default')
const identity={x:0,y:0,z:0,w:1}
const quarter={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}
assert.ok(Math.abs(angleBetweenQuaternionsDegrees(identity,quarter)-90)<1e-7)
assert.equal(angleBetweenQuaternionsDegrees(identity,identity),0)
assert.equal(angleBetweenQuaternionsDegrees(identity,{x:0,y:0,z:0,w:-1}),0)
const none=new Vq03MotionEvidence()
assert.equal(none.addFrame(0,[90],false),false,'Inactive mixer cannot prove motion')
assert.equal(none.snapshot().fbxFrames,0)
assert.equal(none.addFrame(Number.NaN,[90],true),false,'Invalid time not evidence')
assert.equal(none.snapshot().fbxFrames,0)
assert.equal(none.addFrame(0,[],true),false)
assert.equal(none.addFrame(.05,[0.3],true),false)
assert.equal(none.addFrame(.16,[1.5],true),false)
assert.equal(none.snapshot().animationEvidence,false,'No post-guard arm motion, no PASS')
assert.equal(none.addFrame(.25,[4.5],true),true)
assert.equal(none.addFrame(.50,[9.0],true),false,'Report once, no frame spam')
const result=none.snapshot()
assert.equal(result.animationEvidence,true)
assert.equal(result.fbxFrames,5)
assert.ok(result.advancedSeconds>=.25)
assert.ok(result.maxArmDeviationDeg>=9)
assert.equal(result.sampledBoneCount,1)
const noArms=new Vq03MotionEvidence()
for(let i=0;i<20;i++)noArms.addFrame(i*.03,[],true)
assert.equal(noArms.snapshot().animationEvidence,false)
const noTime=new Vq03MotionEvidence()
for(let i=0;i<20;i++)noTime.addFrame(0,[30],true)
assert.equal(noTime.snapshot().animationEvidence,false)

const originalLog=console.info
let calls=0
try{
  console.info=()=>{calls++}
  reportVq03AvatarQA({event:'vrm-first-frame',view:'bust-vrm',clipEnabled:true,bodyBones:22})
  reportVq03AvatarQA({event:'motion-pose-progress',id:'waving',...result})
}finally{console.info=originalLog}
assert.equal(calls,0,'QA logger must never run without explicit opt-in')

setLumiaAvatarView('head-vrm')
assert.ok(requestLumiaAvatarMotion('waving'))
assert.equal(avatarPresenceSnapshot().view,'bust-vrm')
assert.equal(avatarPresenceSnapshot().motion?.id,'waving')
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const scene=read('src/scene/LumiaPortalHead.tsx')
const motions=read('src/scene/lumia-motion-r8/portal-body-companion.ts')
const launcher=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const baseline=read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
assert.match(scene,/event:'vrm-first-frame',view:avatarView/)
assert.match(scene,/const semantic = body\?\.step\(dt, phase, speakingAudio\)/)
assert.match(motions,/event:'motion-requested'/)
assert.match(motions,/event:'motion-started'/)
assert.match(motions,/event:'motion-pose-progress'/)
assert.match(motions,/event:'motion-unavailable'/)
assert.match(motions,/this\.action\.isRunning\(\)/)
assert.match(motions,/boundR8BodyPose/)
assert.match(launcher,/VITE_LUMIA_AVATAR_QA_VQ03=1/)
assert.doesNotMatch(baseline,/VITE_LUMIA_AVATAR_QA_VQ03/)
console.log('VQ-03.2 PASS: VRM mounted first frame, FBX mixer advancing AND post-guard arm motion, safe no-motion failures, off by default')
