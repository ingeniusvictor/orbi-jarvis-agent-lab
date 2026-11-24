import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {makeSameFrameFaceEvidence,sameFrameLog} from '../src/lib/vision-same-frame-vi042a'
import {groundedFreshScenePrompt,classifyVisualQuestionFocus,groundedFaceCountHint} from '../src/lib/vision-count-grounding-vi042b'
import {auditFreshSceneAtTurn} from '../src/lib/vision-audit-vi041'

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
for(const n of [0,1,2,8]){
  const e=makeSameFrameFaceEvidence('synthetic-photo','matched',n,203)
  assert.equal(e.faceCount,n)
  assert.equal(e.sameJpeg,true)
  assert.equal(e.facesArePeople,false)
  assert.match(groundedFaceCountHint(e),new RegExp('detectaron '+n+' rostros? visibles?'))
}
for(const status of ['detector-off','detector-unavailable','timeout','cancelled','error'] as const){
  assert.equal(makeSameFrameFaceEvidence('p',status,2).faceCount,null)
  assert.equal(groundedFaceCountHint(makeSameFrameFaceEvidence('p',status,2)),'')
}
const e=makeSameFrameFaceEvidence('s', 'matched', 1, 203)
const log=sameFrameLog(e,123)
assert.equal(log.frameAgeMs,123)
for(const k of ['image','pixels','identity','embedding','prompt','data'])assert.ok(!Object.hasOwn(log,k))
assert.equal(classifyVisualQuestionFocus('¿Tengo la mano derecha levantada?'),'body-posture')
assert.equal(classifyVisualQuestionFocus('¿Cuántas personas y qué están haciendo?'),'people-count')
assert.equal(classifyVisualQuestionFocus('Describe lo que ves.'),'general')
const body=groundedFreshScenePrompt('¿Tengo el brazo derecho levantado?',false,e)
assert.match(body,/TODO el encuadre/)
assert.match(body,/no se distingue/)
assert.doesNotMatch(body,/se detectaron 1 rostro visible/)
const people=groundedFreshScenePrompt('¿Cuántas personas ves?',false,e)
assert.match(people,/se detectaron 1 rostro visible/)
assert.match(people,/no confirma el total de personas/)
assert.match(people,/no supongas personas al fondo/i)
const raw=auditFreshSceneAtTurn({
 cameraAuthorized:true,capturedAt:1000,detectorEnabled:true,
 faceSample:{count:1,observedAt:995},now:1005,
})
assert.equal(raw.status,'face-presence-available')
assert.equal(raw.faceEvidenceIsIdentity,false)
const app=read('src/App.tsx')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const worker=read('src/lib/vision-face-worker-vi04.ts')
const vite=read('vite.config.ts')
const startup=read('scripts/start.mjs')
const launch=read('INICIAR_LUMIA_VISION_RC01_ASUS.cmd')
const original=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(app,/VITE_LUMIA_VISION_SAME_FRAME_VI042A/)
assert.match(app,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B/)
assert.match(app,/sameFrameLog/)
assert.match(app,/groundedFreshScenePrompt/)
assert.match(ui,/sameFrameDetectorRef/)
assert.match(ui,/SAME_FRAME_AUDIT_TIMEOUT_MS/)
assert.match(ui,/AUDIT_FRAME/)
assert.match(worker,/FilesetResolver\.forVisionTasks\('\/mediapipe',true\)/)
assert.match(vite,/mediapipe/)
assert.match(startup,/vision_wasm_module_internal\.wasm/)
assert.match(launch,/VITE_LUMIA_VISION_FACES_VI04A=1/)
assert.match(launch,/VITE_LUMIA_VISION_SAME_FRAME_VI042A=1/)
assert.match(launch,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B=1/)
assert.match(launch,/INICIAR_LUMIA_ASUS_ROSTROS_VI040A\.cmd/)
assert.match(launch,/LUMIA-ASUS/)
const assets=read('scripts/lumia-private-avatar-assets-rc01.mjs')
assert.match(assets,/COPYFILE_EXCL/)
assert.match(assets,/SOURCE_EQUALS_TARGET/)
assert.match(assets,/DESTINATION_NOT_RC01_WORKTREE/)
assert.match(assets,/join\(destination,'INICIAR_LUMIA_VISION_RC01_ASUS\.cmd'\)/)
assert.doesNotMatch(assets,/INICIAR_LUMIA_ASUS_VISION_AUDITORIA_RC01\.cmd/)
assert.match(launch,/lumia-private-avatar-assets-rc01\.mjs/)

assert.doesNotMatch(original,/VITE_LUMIA_VISION_SAME_FRAME_VI042A|VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B/)
assert.doesNotMatch(launch,/JARVIS_ALLOW_WRITES=1|LUMIA_ASUS_MODEL_OVERRIDE|ORBIA_LUMIA_MODEL=qwen3\.5:4b/)
console.log('LUMIA VI-04.2B.3 RC01 PASS: 0/1/2 face evidence, body prompts, same JPEG, original unchanged and opt-in launcher')
