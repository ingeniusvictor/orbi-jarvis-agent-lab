import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {classifyVisualQuestionFocus,groundedFaceCountHint,groundedFreshScenePrompt}
  from '../src/lib/vision-count-grounding-vi042b'
import {makeSameFrameFaceEvidence} from '../src/lib/vision-same-frame-vi042a'

const one=makeSameFrameFaceEvidence('same-jpeg','matched',1,118)
const two=makeSameFrameFaceEvidence('same-jpeg-two','matched',2,114)
const question='Lumi, describe lo que ves en la cámara. ¿Tengo algún brazo levantado? ¿Qué parte de mi cuerpo puedes distinguir?'
assert.equal(classifyVisualQuestionFocus(question),'body-posture')
for(const phrase of [
  '¿Tengo la mano derecha levantada?',
  'Observa mi postura y los hombros.',
  '¿Se aprecia mi torso?',
  '¿Tengo el brazo apoyado?',
  '¿Estoy sosteniendo algo con la mano?',
  '¿Tengo ambas piernas visibles?',
]){
  assert.equal(classifyVisualQuestionFocus(phrase),'body-posture',phrase)
}
const body=groundedFreshScenePrompt(question,false,one)
assert.match(body,/examina TODO el encuadre, no solo el rostro/)
assert.match(body,/revisa cabeza, hombros, torso, brazos y manos/)
assert.match(body,/sí, no o no se distingue/)
assert.match(body,/Responde directamente en una o dos frases naturales/)
assert.ok(body.endsWith('Pregunta del usuario: '+question))
assert.doesNotMatch(body,/se detectaron 1 rostro|comprobación CPU|Primero cuent|Responde primero cuántas personas/)
assert.equal(groundedFreshScenePrompt(question,false,one),groundedFreshScenePrompt(question,false,two))
assert.equal(groundedFreshScenePrompt(question,false,one),
  groundedFreshScenePrompt(question,false,makeSameFrameFaceEvidence('p','detector-off')))
assert.match(groundedFreshScenePrompt(question,true,one),/reconsidera la imagen actual/)

// Regression: the three successful owner QA count replies were produced using
// this separate face-grounded prompt. It must remain unchanged by VI-04.2B.3.
const countQ='Lumi, observa lo que tienes delante y dime cuántas personas ves y qué están haciendo.'
assert.equal(classifyVisualQuestionFocus(countQ),'people-count')
for(const phrase of [
  '¿Cuántos rostros detectas?',
  'Cuenta las personas visibles',
  '¿Cuál es el número de personas que hay?',
  '¿Cuántas personas hay y tienen algún brazo levantado?',
]){
  assert.equal(classifyVisualQuestionFocus(phrase),'people-count',phrase)
}
const countOne=groundedFreshScenePrompt(countQ,false,one)
assert.match(countOne,/detectaron 1 rostro visible/)
assert.match(countOne,/no confirma el total de personas/)
assert.match(countOne,/No supongas personas al fondo/)
assert.match(countOne,/no supongas que está al centro/)
assert.match(countOne,/Responde primero cuántas personas/)
assert.match(groundedFreshScenePrompt(countQ,false,two),/detectaron 2 rostros visibles/)
assert.doesNotMatch(groundedFreshScenePrompt(countQ,false,makeSameFrameFaceEvidence('p','timeout')),
  /detectaron \d+ rostros/)
for(const n of [0,1,2,8]){
  assert.match(groundedFaceCountHint(makeSameFrameFaceEvidence('p','matched',n,100)),
    new RegExp('detectaron '+n+' rostros? visibles?'))
}

// Generic, unrelated questions keep the same legacy prompt, not body routing.
assert.equal(classifyVisualQuestionFocus('Lumi, describe lo que ves en la cámara.'),'general')
assert.match(groundedFreshScenePrompt('Lumi, describe lo que ves en la cámara.',false,one),
  /detectaron 1 rostro visible/)

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const source=read('src/lib/vision-count-grounding-vi042b.ts')
const launcher=read('INICIAR_LUMIA_ASUS_NEXT_QA.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(app,/groundedFreshScenePrompt\(said,voiceIntent==='visual-correction',liveFrame\.sameFrameFace\)/)
assert.match(ui,/const image=takeActiveFrame\(\)/)
assert.match(ui,/sameFrameDetectorRef\.current\(image,captureId\)/)
assert.match(launcher,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B/)
assert.doesNotMatch(source,/getUserMedia|localStorage|indexedDB|fetch\(|console\.info|console\.log/)
console.log('VI-04.2B.3 PASS: same Qwen JPEG and CPU audit, body questions without face priming, count path preserved')
