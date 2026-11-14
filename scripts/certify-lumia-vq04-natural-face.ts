import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {NaturalFaceMotionVQ04} from '../src/scene/lumia-head/natural-face-vq04'

const at60fps=1/60
const controller=new NaturalFaceMotionVQ04()
const duplicate=new NaturalFaceMotionVQ04()
const blinkStarts:number[]=[]
let insideBlink=false
let largestBlink=0
let maxYaw=0
let maxPitch=0
let previousBlink=0
let prevYaw=0
let prevPitch=0
let eyesMoved=false
for(let frame=0;frame<90*60;frame++){
  const sec=frame*at60fps
  const phase=sec<15?'idle':sec<35?'listening':sec<50?'thinking':
    sec<75?'speaking':'idle'
  const speaking=phase==='speaking'
  const a=controller.step(at60fps,phase,speaking)
  const b=duplicate.step(at60fps,phase,speaking)
  assert.deepEqual(a,b,'deterministic local timing, no frame jitter')
  assert.ok(Number.isFinite(a.blink) && a.blink>=0 && a.blink<=1)
  assert.ok(Math.abs(a.eyeYaw)<=.024+1e-10)
  assert.ok(Math.abs(a.eyePitch)<=.014+1e-10)
  assert.ok(Math.abs(a.eyeYaw-prevYaw)<.007,
    'eye gaze transition must be smooth; no sudden jerk')
  assert.ok(Math.abs(a.eyePitch-prevPitch)<.007,
    'eye gaze transition must be smooth; no sudden jerk')
  assert.ok(Math.abs(a.blink-previousBlink)<.42,
    'eyelid should not jump open/closed instantaneously')
  if(a.blink>.5 && !insideBlink)blinkStarts.push(sec)
  insideBlink=a.blink>.5
  largestBlink=Math.max(largestBlink,a.blink)
  maxYaw=Math.max(maxYaw,Math.abs(a.eyeYaw))
  maxPitch=Math.max(maxPitch,Math.abs(a.eyePitch))
  eyesMoved ||= Math.abs(a.eyeYaw)>.002 && Math.abs(a.eyePitch)>.0007
  prevYaw=a.eyeYaw;prevPitch=a.eyePitch;previousBlink=a.blink
}
assert.ok(blinkStarts.length>=12 && blinkStarts.length<=38,
  'natural blink density over 90 s')
const intervals=blinkStarts.slice(1).map((t,i)=>t-blinkStarts[i])
assert.ok(new Set(intervals.map(x=>Math.round(x*10))).size>8,
  'non-periodic variable cadence')
assert.ok(intervals.some(x=>x<1),
  'occasional double blink actually occurs')
assert.ok(intervals.some(x=>x>4.5),
  'ordinary natural gaps also occur')
assert.ok(largestBlink>.94)
assert.ok(maxYaw>.003 && maxPitch>.002 && eyesMoved)
assert.deepEqual(controller.step(Number.NaN,'idle',false),
  controller.step(0,'idle',false),
  'invalid frame dt must be bounded to zero')
const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const renderer=file('src/scene/LumiaPortalHead.tsx')
const qa=file('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const daily=file('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const direct=file('src/scene/lumia-motion-r8/portal-body-companion.ts')
const events=file('src/scene/lumia-motion-r8/avatar-runtime-audit-vq03.ts')
assert.match(qa,/set "VITE_LUMIA_NATURAL_FACE_VQ04=1"/)
assert.doesNotMatch(daily,/VITE_LUMIA_NATURAL_FACE_VQ04/)
assert.match(renderer,/NaturalFaceMotionVQ04/)
assert.match(renderer,/micro\?\.blink \?\?/)
assert.match(renderer,/micro\?\.eyeYaw\?\?0/)
assert.match(renderer,/micro\?\.eyePitch\?\?0/)
assert.match(renderer,/natural-face-observed/)
assert.match(events,/natural-face-observed/)
assert.match(renderer,/approximateVowel\(speech\.current\.text, elapsed\)/)
assert.match(renderer,/body\?\.step\(dt, phase, speakingAudio\)/)
assert.match(direct,/this\.activeMixer\.update\(dt\)/)
console.log(
  'VQ-04 PASS: real VRM eyelids and eyes; '+blinkStarts.length+
  ' nonperiodic blinks/90s, safe micro-gaze, unchanged TTS visemes, FBX, and production flag',
)
