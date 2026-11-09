import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  FaceCountGate,normalizeDetectedFaces,FACE_DETECTOR_INTERVAL_MS,
  FACE_DETECTOR_MAX_WIDTH,FACE_DETECTOR_MAX_HEIGHT,FACE_DETECTOR_MAX_RESULTS,
} from '../src/lib/vision-faces-vi04'

assert.equal(FACE_DETECTOR_INTERVAL_MS,900)
assert.equal(FACE_DETECTOR_MAX_WIDTH,640)
assert.equal(FACE_DETECTOR_MAX_HEIGHT,360)
assert.equal(FACE_DETECTOR_MAX_RESULTS,8)
const detections=[
  {boundingBox:{originX:64,originY:36,width:128,height:90},categories:[{score:.92}]},
  {boundingBox:{originX:320,originY:108,width:160,height:144},categories:[{score:.84}]},
]
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`Expected ${a} ≈ ${b}`)
const faces=normalizeDetectedFaces(detections,640,360)
assert.equal(faces.length,2)
near(faces[0].x,.1)
near(faces[0].y,.1)
near(faces[0].width,.2)
near(faces[0].height,.25)
near(faces[1].x,.5)
near(faces[1].y,.3)
near(faces[1].width,.25)
near(faces[1].height,.4)
assert.equal(normalizeDetectedFaces(detections,0,360).length,0)
assert.equal(normalizeDetectedFaces(detections,640,0).length,0)
assert.equal(normalizeDetectedFaces([
  {boundingBox:{originX:-50,originY:0,width:100,height:50},categories:[{score:.95}]},
],100,100)[0].x,0)
assert.equal(normalizeDetectedFaces([
  {boundingBox:{originX:0,originY:0,width:50,height:50},categories:[{score:.10}]},
  {boundingBox:{originX:0,originY:0,width:0,height:50},categories:[{score:.90}]},
],100,100).length,0)
const gate=new FaceCountGate()
assert.equal(gate.observe(1,1000),null)
assert.equal(gate.observe(1,1900),1)
assert.equal(gate.observe(2,2800),1) // one isolated count cannot instantly change the display
assert.equal(gate.observe(2,3700),2)
assert.equal(gate.observe(0,8000),null) // stale gap invalidates the old count
assert.equal(gate.observe(0,8900),0)
gate.reset()
assert.equal(gate.observe(2,9800),null)

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const worker=read('src/lib/vision-face-worker-vi04.ts')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const launcher=read('INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd')
const installer=read('scripts/install-lumia-face-model-vi04.mjs')
const ignore=read('.gitignore')

assert.match(worker,/FaceDetector\.createFromOptions/)
assert.match(worker,/modelAssetPath:'\/models\/vision\/blaze_face_short_range\.tflite'/)
assert.match(worker,/delegate:'CPU'/)
assert.match(worker,/runningMode:'VIDEO'/)
assert.match(worker,/detectForVideo\(bitmap,lastStamp\)/)
assert.match(worker,/bitmap\.close\(\)/)
assert.doesNotMatch(worker,/getUserMedia|navigator\.mediaDevices/)
assert.doesNotMatch(worker,/localStorage|indexedDB|speechSynthesis|fetch\(.*image/)
assert.match(ui,/new Worker\(new URL\('\.\.\/lib\/vision-face-worker-vi04\.ts'/)
assert.match(ui,/createImageBitmap\(video/)
assert.match(ui,/resizeWidth:width,resizeHeight:height/)
assert.match(ui,/worker\.terminate\(\)/)
assert.match(ui,/FACE_DETECTOR_INTERVAL_MS/)
assert.match(ui,/Detectar rostros · CPU/)
assert.match(ui,/faceCount===1\?'1 rostro detectado'/)
assert.match(ui,/lumia-face-detector-overlay/)
assert.match(ui,/setFaceEnabled\(false\)/)
assert.match(ui,/document\.visibilityState!=='visible'/)
assert.match(app,/VISION_FACE_DETECTOR_VI04A_ENABLED/)
assert.match(app,/faceDetectorAvailable=\{VISION_FACE_DETECTOR_VI04A_ENABLED\}/)
assert.match(launcher,/VITE_LUMIA_VISION_FACES_VI04A=1/)
assert.match(launcher,/install-lumia-face-model-vi04\.mjs/)
assert.match(launcher,/INICIAR_LUMIA_ASUS_VISION_REVISAR_VI032B\.cmd/)
assert.match(installer,/storage\.googleapis\.com\/mediapipe-models\/face_detector/)
assert.match(installer,/TFL3/)
assert.match(ignore,/public\/models\/vision\/\*\.tflite/)
console.log('VISION-04A PASS: multiple face boxes, stable count, local CPU worker, explicit permission, no biometric identification, native 2B launcher')
