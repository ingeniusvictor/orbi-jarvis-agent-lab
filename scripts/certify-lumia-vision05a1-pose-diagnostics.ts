import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  BodyPoseGate,poseDiagnosticText,summarizeBodyPose,
  POSE_VI05_MIN_VISIBILITY,type PoseLandmark,
} from '../src/lib/vision-pose-vi05'

const fixture=():PoseLandmark[]=>{
  const p=Array.from({length:33},()=>({
    x:0.5,y:0.5,visibility:0.99,presence:0.99,
  }))
  p[11]={x:0.3,y:0.46,visibility:0.98,presence:0.99}
  p[13]={x:0.28,y:0.38,visibility:0.98,presence:0.99}
  p[15]={x:0.28,y:0.19,visibility:0.98,presence:0.99}
  p[12]={x:0.7,y:0.46,visibility:0.98,presence:0.99}
  p[14]={x:0.72,y:0.66,visibility:0.98,presence:0.99}
  p[16]={x:0.73,y:0.83,visibility:0.98,presence:0.99}
  return p
}
const p=fixture()
const normal=summarizeBodyPose([p],405)
assert.equal(normal.found,true)
assert.equal(normal.leftArm,'raised')
assert.equal(normal.leftDiagnostic,'raised')
assert.equal(normal.rightArm,'down')
assert.equal(normal.rightDiagnostic,'down')
assert.equal(normal.shouldersVisible,true)
assert.equal(normal.inferenceMs,405)
assert.equal(normal.stabilizing,false)

const missing=summarizeBodyPose([p.slice(0,16)])
assert.equal(missing.found,false)
assert.equal(missing.leftDiagnostic,'no-pose')

const lowWrist=fixture()
lowWrist[15].visibility=POSE_VI05_MIN_VISIBILITY-0.01
const low=summarizeBodyPose([lowWrist])
assert.equal(low.leftArm,'unclear')
assert.equal(low.leftDiagnostic,'wrist-low-confidence')
assert.equal(low.rightArm,'down')

const outsideWrist=fixture()
outsideWrist[15].y=-0.05
assert.equal(summarizeBodyPose([outsideWrist]).leftDiagnostic,'wrist-outside')

const absentWrist=fixture()
absentWrist[15]={x:NaN,y:0.2}
assert.equal(summarizeBodyPose([absentWrist]).leftDiagnostic,'wrist-missing')

const noScore=fixture()
noScore[15]={x:0.2,y:0.2}
assert.equal(summarizeBodyPose([noScore]).leftDiagnostic,'wrist-no-confidence')

const noShoulder=fixture()
noShoulder[11].visibility=0.1
assert.equal(summarizeBodyPose([noShoulder]).leftDiagnostic,'shoulder-low-confidence')

const mid=fixture()
mid[15].y=mid[11].y
assert.equal(summarizeBodyPose([mid]).leftDiagnostic,'angle-ambiguous')

const nothing=summarizeBodyPose([])
assert.equal(nothing.found,false)
assert.equal(nothing.leftDiagnostic,'no-pose')
assert.equal(nothing.rightDiagnostic,'no-pose')

const gate=new BodyPoseGate()
const first=gate.observe(normal)
assert.equal(first.stabilizing,true)
assert.equal(first.leftArm,'unclear')
assert.equal(first.leftDiagnostic,'raised') // classification evidence not discarded
const second=gate.observe(normal)
assert.equal(second.stabilizing,false)
assert.equal(second.leftArm,'raised')
assert.equal(second.rightArm,'down')
gate.reset()
assert.equal(gate.observe(normal).stabilizing,true)
assert.equal(gate.observe(normal).stabilizing,false)
assert.equal(gate.observe(low).stabilizing,true)
assert.equal(gate.observe(low).leftArm,'unclear')
assert.equal(gate.observe(low).stabilizing,false)

assert.match(poseDiagnosticText('wrist-low-confidence'),/muñeca poco fiable/)
assert.match(poseDiagnosticText('wrist-outside'),/muñeca fuera del encuadre/)
assert.match(poseDiagnosticText('angle-ambiguous'),/ángulo no concluyente/)

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const worker=read('src/lib/vision-pose-worker-vi05.ts')
const source=read('src/lib/vision-pose-vi05.ts')
const app=read('src/App.tsx')
const qaLauncher=read('INICIAR_LUMIA_VISION_RC02_ASUS.cmd')
const dailyLauncher=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')

assert.match(ui,/poseDiagnosticText\(poseSummary\.leftDiagnostic\)/)
assert.match(ui,/poseDiagnosticText\(poseSummary\.rightDiagnostic\)/)
assert.match(ui,/leftDiagnostic:stable\.leftDiagnostic/)
assert.match(ui,/rightDiagnostic:stable\.rightDiagnostic/)
assert.match(ui,/setPoseEnabled\(false\)/)
assert.match(ui,/document\.visibilityState!=='visible'/)
assert.match(ui,/POSE_VI05_RESPONSE_TIMEOUT_MS/)
assert.match(worker,/delegate:'CPU'/)
assert.match(worker,/bitmap\.close\(\)/)
assert.doesNotMatch(source,/getUserMedia|localStorage|indexedDB|fetch\(|console\./)
assert.doesNotMatch(worker,/getUserMedia|localStorage|indexedDB|fetch\(|console\./)
assert.match(qaLauncher,/VITE_LUMIA_VISION_POSE_VI05A=1/)
assert.doesNotMatch(dailyLauncher,/VITE_LUMIA_VISION_POSE_VI05A/)
assert.match(app,/groundedFreshScenePrompt\(said,voiceIntent==='visual-correction',liveFrame\.sameFrameFace\)/)
console.log('VI-05A.1 PASS: diagnostics preserve cautious arm states, debounce, privacy and prior vision routing')
