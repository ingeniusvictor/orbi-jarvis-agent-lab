import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  SAME_FRAME_AUDIT_TIMEOUT_MS,makeSameFrameFaceEvidence,sameFrameLog,
} from '../src/lib/vision-same-frame-vi042a'

assert.equal(SAME_FRAME_AUDIT_TIMEOUT_MS,850)
for(const count of [0,1,2,8]){
  const observed=makeSameFrameFaceEvidence('test-photo','matched',count,122.4)
  assert.equal(observed.status,'matched')
  assert.equal(observed.faceCount,count)
  assert.equal(observed.inferenceMs,122)
  assert.equal(observed.sameJpeg,true)
  assert.equal(observed.facesArePeople,false)
}
for(const count of [-1,1.5,9,NaN,Infinity,null]){
  const invalid=makeSameFrameFaceEvidence('p','matched',count,1)
  assert.equal(invalid.status,'error')
  assert.equal(invalid.faceCount,null)
  assert.equal(invalid.sameJpeg,false)
}
for(const status of ['detector-off','detector-unavailable','timeout','cancelled','error'] as const){
  const noEvidence=makeSameFrameFaceEvidence('p',status,2,100)
  assert.equal(noEvidence.faceCount,null)
  assert.equal(noEvidence.inferenceMs,null)
  assert.equal(noEvidence.sameJpeg,false)
}
const log=sameFrameLog(makeSameFrameFaceEvidence('qa-photo','matched',1,101),21.7)
assert.deepEqual(log,{
  captureId:'qa-photo',status:'matched',faceCount:1,
  inferenceMs:101,sameJpeg:true,facesArePeople:false,frameAgeMs:22,
})
assert.equal(sameFrameLog(makeSameFrameFaceEvidence('p','timeout'),-2).frameAgeMs,null)
assert.throws(()=>makeSameFrameFaceEvidence('', 'matched',1))
for(const privateField of ['data','bytes','prompt','transcript','embeddings','identity','image','photoPixels']){
  assert.ok(!Object.hasOwn(log,privateField))
}
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const worker=read('src/lib/vision-face-worker-vi04.ts')
const app=read('src/App.tsx')
const active=read('src/lib/vision-active-vi031.ts')
const launcher=read('INICIAR_LUMIA_ASUS_NEXT_QA.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')

// Both analyses MUST be derived from the very same authorized JPEG.
// The live periodic overlay is intentionally not used as same-frame evidence.
assert.match(ui,/const image=takeActiveFrame\(\)/)
assert.match(ui,/const binary=atob\(image\.data\)/)
assert.match(ui,/new Blob\(\[bytes\],\{type:'image\/jpeg'\}\)/)
assert.match(ui,/bitmap=await createImageBitmap\(blob\)/)
assert.match(ui,/type:'AUDIT_FRAME',bitmap,timestampMs:performance\.now\(\),captureId/)
assert.match(ui,/SAME_FRAME_AUDIT_TIMEOUT_MS/)
assert.match(ui,/cancelAudits\(\)/)
assert.match(ui,/epoch!==activeEpochRef\.current/)
assert.match(ui,/sameFrameDetectorRef\.current\(image,captureId\)/)
assert.match(ui,/if\(!sameFrameEnabled\)return frame/)
assert.match(ui,/worker\.terminate\(\)/)
assert.match(worker,/type:'AUDIT_FRAME'/)
assert.match(worker,/type:'AUDIT_RESULT'/)
assert.match(worker,/type:'AUDIT_ERROR'/)
assert.match(worker,/detectForVideo\(bitmap,lastStamp\)/)
assert.match(worker,/bitmap\.close\(\)/)
assert.doesNotMatch(worker,/getUserMedia|navigator\.mediaDevices|indexedDB|localStorage/)
assert.match(active,/sameFrameFace\?:SameFrameFaceEvidence/)
assert.match(app,/await activeVisionCapture\.current\?\.\(\)/)
assert.match(app,/if\(stale\(\)\)return/)
assert.match(app,/sameFrameLog\(liveFrame\.sameFrameFace/)
assert.match(app,/\[lumia:vision-vi042a\]/)
assert.match(app,/sameFrameEnabled=\{VISION_SAME_FRAME_VI042A_ENABLED\}/)
assert.match(launcher,/VITE_LUMIA_VISION_SAME_FRAME_VI042A=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_VISION_SAME_FRAME_VI042A/)
assert.doesNotMatch(ui,/indexedDB|localStorage|sendBeacon/)
console.log('VI-04.2A PASS: typed 0-8 face evidence, Qwen JPEG provenance, timeout/cancel guards, isolated NEXT pilot')
