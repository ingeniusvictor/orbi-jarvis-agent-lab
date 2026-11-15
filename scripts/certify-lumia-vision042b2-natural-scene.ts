import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {groundedFaceCountHint,groundedFreshScenePrompt} from '../src/lib/vision-count-grounding-vi042b'
import {makeSameFrameFaceEvidence} from '../src/lib/vision-same-frame-vi042a'

// VI-04.2B.1 is physically approved for 1 moving face in 3 consecutive turns:
// do not change the CPU evidence selection, counts, or missing-detector gate.
for(const count of [0,1,2,8]){
  const face=makeSameFrameFaceEvidence('photo-test','matched',count,124)
  const hint=groundedFaceCountHint(face)
  assert.match(hint,new RegExp('detectaron '+count+' rostros? visibles?'))
  assert.match(hint,/no confirma el total de personas/)
  assert.match(hint,/evidencia visual independiente/)
}
for(const status of ['timeout','error','detector-off','detector-unavailable','cancelled'] as const){
  assert.equal(groundedFaceCountHint(makeSameFrameFaceEvidence('p',status)),'')
}
assert.equal(groundedFaceCountHint(null),'')
assert.equal(groundedFaceCountHint(undefined),'')
const q='Lumi, observa lo que tienes delante y dime cuántas personas ves y qué están haciendo.'
const p=groundedFreshScenePrompt(q,false,makeSameFrameFaceEvidence('p','matched',1,105))
assert.ok(p.endsWith('Pregunta del usuario: '+q))
assert.match(p,/solo se aprecia un rostro y no el cuerpo/)
assert.match(p,/qué están haciendo SOLO si la postura o actividad se ve/)
assert.match(p,/si no puedes determinar la acción/i)
assert.match(p,/no supongas que está al centro/)
assert.match(p,/imagen ACTUAL/)
assert.match(p,/una o dos frases naturales/)
assert.match(p,/no fuerces un número/i)
assert.match(p,/detectaron 1 rostro visible/)
assert.match(p,/no confirma el total de personas/)
assert.doesNotMatch(p,/Atlanta|RLW|NASA|hijo|hija/)
assert.doesNotMatch(p,/las tres personas están/)
const noDetector=groundedFreshScenePrompt(q,false,null)
assert.doesNotMatch(noDetector,/detectaron \d+ rostros? visibles?/)
assert.match(noDetector,/si no puedes determinar la acción/i)
const correction=groundedFreshScenePrompt(q,true,makeSameFrameFaceEvidence('p','matched',2,99))
assert.match(correction,/reconsidera la imagen actual/)
assert.match(correction,/detectaron 2 rostros visibles/)
assert.throws(()=>makeSameFrameFaceEvidence('','matched',1))

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const source=read('src/lib/vision-count-grounding-vi042b.ts')
const app=read('src/App.tsx')
const launcher=read('INICIAR_LUMIA_ASUS_NEXT_QA.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const faceWorker=read('src/lib/vision-face-worker-vi04.ts')
assert.match(source,/caution\+groundedFaceCountHint\(evidence\)/)
assert.match(app,/groundedFreshScenePrompt\(said,voiceIntent==='visual-correction',liveFrame\.sameFrameFace\)/)
assert.match(app,/freshCameraScenePrompt\(said,voiceIntent==='visual-correction'\)/)
assert.match(launcher,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B=1/)
assert.match(launcher,/VITE_LUMIA_VISION_SAME_FRAME_VI042A=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_VISION_(?:COUNT_GROUNDING_VI042B|SAME_FRAME_VI042A)/)
assert.match(faceWorker,/FaceDetector\.createFromOptions/)
assert.doesNotMatch(source,/getUserMedia|localStorage|indexedDB|fetch\(|console\.log|console\.info/)
console.log('VI-04.2B.2 PASS: preserve same-JPEG face hint and pilot gating; natural actions and evidence-based position')
