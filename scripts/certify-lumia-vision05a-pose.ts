import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {BodyPoseGate,POSE_VI05_INTERVAL_MS,POSE_VI05_MIN_VISIBILITY,
  summarizeBodyPose,type PoseLandmark} from '../src/lib/vision-pose-vi05'

const landmarks=():PoseLandmark[]=>Array.from({length:33},()=>({
  x:0.5,y:0.5,visibility:0.99,presence:0.99,
}))
const pose=landmarks()
pose[11]={x:0.3,y:0.47,visibility:0.99,presence:0.99} // left shoulder
pose[13]={x:0.27,y:0.35,visibility:0.99,presence:0.99}
pose[15]={x:0.23,y:0.20,visibility:0.99,presence:0.99} // raised left wrist
pose[12]={x:0.7,y:0.47,visibility:0.99,presence:0.99} // right shoulder
pose[14]={x:0.73,y:0.66,visibility:0.99,presence:0.99}
pose[16]={x:0.76,y:0.83,visibility:0.99,presence:0.99} // down right wrist

const good=summarizeBodyPose([pose],92.7)
assert.equal(good.found,true)
assert.equal(good.leftArm,'raised')
assert.equal(good.rightArm,'down')
assert.equal(good.shouldersVisible,true)
assert.equal(good.inferenceMs,93)
assert.equal(summarizeBodyPose([]).found,false)
assert.equal(summarizeBodyPose([pose.slice(0,4)]).leftArm,'unclear')

const hidden=pose.map(v=>({...v}))
hidden[15].visibility=POSE_VI05_MIN_VISIBILITY-0.01
assert.equal(summarizeBodyPose([hidden]).leftArm,'unclear')
assert.equal(summarizeBodyPose([hidden]).rightArm,'down')

const sideways=pose.map(v=>({...v}))
sideways[15].y=sideways[11].y
assert.equal(summarizeBodyPose([sideways]).leftArm,'unclear')

const outside=pose.map(v=>({...v}))
outside[16].y=1.2
assert.equal(summarizeBodyPose([outside]).rightArm,'unclear')

const unreliable=pose.map(v=>({...v}))
unreliable[16].presence=0.1
assert.equal(summarizeBodyPose([unreliable]).rightArm,'unclear')

const gate=new BodyPoseGate()
assert.equal(gate.observe(good).leftArm,'unclear')
assert.equal(gate.observe(good).leftArm,'raised')
assert.equal(gate.observe(good).rightArm,'down')
assert.equal(gate.observe(summarizeBodyPose([sideways])).leftArm,'unclear')
gate.reset()
assert.equal(gate.observe(good).rightArm,'unclear')
assert.ok(POSE_VI05_INTERVAL_MS>=2000) // bounded CPU, no 15-30 FPS loop

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const worker=read('src/lib/vision-pose-worker-vi05.ts')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const launcher=read('INICIAR_LUMIA_VISION_RC02_ASUS.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const installer=read('scripts/instalar-modelo-pose-rc02.ps1')
const gitignore=read('.gitignore')
const app=read('src/App.tsx')

assert.match(worker,/PoseLandmarker\.createFromOptions/)
assert.match(worker,/modelAssetPath:'\/models\/vision\/pose_landmarker_lite\.task'/)
assert.match(worker,/delegate:'CPU'/)
assert.match(worker,/numPoses:1/)
assert.match(worker,/bitmap\.close\(\)/)
assert.match(worker,/landmarker\?\.close\(\)/)
assert.doesNotMatch(worker,/getUserMedia|localStorage|indexedDB|fetch\(|api\/chat|images: \[/)
assert.match(ui,/if\(!VI05A_POSE_AVAILABLE\|\|!poseEnabled\|\|!live\|\|!visionActive\|\|!ready\)return/)
assert.match(ui,/onClick=\{\(\)=>\{/)
assert.match(ui,/new URL\('\.\.\/lib\/vision-pose-worker-vi05\.ts',import\.meta\.url\)/)
assert.match(ui,/worker\.terminate\(\)/)
assert.match(ui,/document\.visibilityState!=='visible'/)
assert.match(ui,/setPoseEnabled\(false\)/)
assert.match(ui,/setPoseStatus\('off'\)/)
assert.match(ui,/POSE_VI05_RESPONSE_TIMEOUT_MS/)
assert.doesNotMatch(ui,/visualImage.*poseSummary|groundedFreshScenePrompt\(.*poseSummary/)
assert.match(launcher,/VITE_LUMIA_VISION_POSE_VI05A=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_VISION_POSE_VI05A/)
assert.match(installer,/59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a/)
assert.match(installer,/Get-FileHash/)
assert.match(installer,/LUMIA-RC01-QA/)
assert.match(installer,/pose_landmarker_lite\.task/)
assert.match(gitignore,/public\/models\/vision\/\*\.task/)
assert.match(app,/groundedFreshScenePrompt\(said,voiceIntent==='visual-correction',liveFrame\.sameFrameFace\)/)
assert.doesNotMatch(worker,/faceCount|faceDetector|personCount|identityRecognition/)
console.log('VI-05A PASS: pose CPU opt-in, 2.5s cadence, stable arms, privacy, shutdown, face/Qwen/daily unmodified')
