import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {auditFreshSceneAtTurn,AUDIT_CURRENT_FRAME_MAX_AGE_MS} from '../src/lib/vision-audit-vi041'
import {FACE_DETECTOR_STALE_MS} from '../src/lib/vision-faces-vi04'

const base={
  cameraAuthorized:true, capturedAt:9_990,
  detectorEnabled:true, faceSample:{count:2,observedAt:9_550},now:10_000,
}
const check=(partial:Partial<typeof base>)=>auditFreshSceneAtTurn({...base,...partial})
assert.equal(AUDIT_CURRENT_FRAME_MAX_AGE_MS,2_000)
assert.equal(FACE_DETECTOR_STALE_MS,3_500)

const measured=check({})
assert.equal(measured.status,'face-presence-available')
assert.equal(measured.faceCount,2)
assert.equal(measured.frameAgeMs,10)
assert.equal(measured.faceSampleAgeAtCaptureMs,440)
assert.equal(measured.faceEvidenceIsIdentity,false)
assert.equal(measured.cameraAutoOpened,false)

assert.equal(check({faceSample:{count:0,observedAt:9_700}}).faceCount,0)
assert.equal(check({faceSample:{count:8,observedAt:9_700}}).faceCount,8)
assert.equal(check({faceSample:{count:9,observedAt:9_700}}).status,'face-detector-unavailable')
assert.equal(check({faceSample:{count:-1,observedAt:9_700}}).status,'face-detector-unavailable')
assert.equal(check({faceSample:{count:1.5,observedAt:9_700}}).status,'face-detector-unavailable')
assert.equal(check({faceSample:{count:NaN,observedAt:9_700}}).status,'face-detector-unavailable')
assert.equal(check({faceSample:null}).status,'face-detector-unavailable')
assert.equal(check({detectorEnabled:false}).status,'face-detector-off')
assert.equal(check({cameraAuthorized:false}).status,'camera-not-authorized')
assert.equal(check({cameraAuthorized:false}).faceCount,null)
assert.equal(check({capturedAt:null}).status,'no-current-frame')
assert.equal(check({capturedAt:10_001}).status,'no-current-frame')
assert.equal(check({capturedAt:7_000}).status,'frame-aged')
assert.equal(check({capturedAt:7_000}).faceCount,null)
assert.equal(check({now:Number.NaN}).status,'no-current-frame')
assert.equal(check({faceSample:{count:2,observedAt:6_000}}).status,'face-detector-stale')
assert.equal(check({faceSample:{count:2,observedAt:10_000}}).status,'face-detector-stale')
assert.equal(check({faceSample:{count:2,observedAt:Number.NaN}}).status,'face-detector-stale')
assert.equal(check({faceSample:{count:2,observedAt:6_490}}).faceCount,2) // exactly 3500 ms

// Read-only diagnostics must not leak the image, people, prompt, embeddings,
// facial vectors, microphone contents or hidden permission changes.
const auditText=JSON.stringify(measured)
for(const forbidden of ['data','prompt','identityName','embeddings','filepath','transcript']){
  assert.ok(!Object.hasOwn(measured,forbidden))
}
assert.doesNotMatch(auditText,/base64|data:image|speaker_|faceEmbedding/i)
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const helper=read('src/lib/vision-audit-vi041.ts')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const active=read('src/lib/vision-active-vi031.ts')
const launcher=read('INICIAR_LUMIA_ASUS_VISION_AUDITORIA_VI041.cmd')
assert.match(launcher,/VITE_LUMIA_VISION_QA_VI041=1/)
assert.match(launcher,/INICIAR_LUMIA_ASUS_ROSTROS_VI040A\.cmd/)
assert.doesNotMatch(launcher,/ollama (?:pull|stop|rm|create)|git (?:reset|checkout|pull)/)
assert.doesNotMatch(helper,/getUserMedia\(|localStorage|indexedDB|fetch\(|\.writeFile|navigator\./)
assert.match(active,/faceAudit\?:VisionFaceSample\|null/)
assert.match(ui,/auditEnabled && faceEnabled && faceStatus==='ready'/)
assert.match(ui,/faceAuditRef\.current=\(confirmed!==null && confirmed===msg\.faces\.length\)/)
assert.match(ui,/faceAuditRef\.current=null/)
assert.match(ui,/onRegisterActiveCapture/)
assert.match(app,/VISION_SCENE_AUDIT_VI041_ENABLED/)
assert.match(app,/auditFreshSceneAtTurn\(/)
assert.match(app,/console\.info\('\[lumia:vision-vi041\]'/)
assert.match(app,/auditEnabled=\{VISION_SCENE_AUDIT_VI041_ENABLED\}/)
assert.match(app,/recentActiveVisionFrame\(true,rawLiveFrame\)/)
assert.match(app,/freshCameraScenePrompt\(said,voiceIntent==='visual-correction'\)/)
console.log('VI-04.1 PASS: fresh-frame age and stable CPU face count linked by metadata, no identity, no reply changes')
