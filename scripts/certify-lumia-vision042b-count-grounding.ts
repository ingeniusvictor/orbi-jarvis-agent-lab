import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {groundedFaceCountHint,groundedFreshScenePrompt} from '../src/lib/vision-count-grounding-vi042b'
import {makeSameFrameFaceEvidence} from '../src/lib/vision-same-frame-vi042a'

const one=makeSameFrameFaceEvidence('photo-one','matched',1,130)
const two=makeSameFrameFaceEvidence('photo-two','matched',2,108)
const zero=makeSameFrameFaceEvidence('photo-zero','matched',0,88)
for(const [evidence,count] of [[one,1],[two,2],[zero,0]] as const){
  const s=groundedFaceCountHint(evidence)
  assert.match(s,new RegExp('detectaron '+count+' rostros? visibles?'))
  assert.match(s,/no confirma el total de personas/)
  assert.match(s,/evidencia visual independiente/)
  assert.doesNotMatch(s,/exactamente (?:una|dos|tres) personas|hay (?:una|dos|tres) personas/i)
}
for(const evidence of [
  null,
  undefined,
  makeSameFrameFaceEvidence('p','detector-off'),
  makeSameFrameFaceEvidence('p','timeout'),
  makeSameFrameFaceEvidence('p','detector-unavailable'),
  makeSameFrameFaceEvidence('p','error'),
]){
  assert.equal(groundedFaceCountHint(evidence),'')
}
const q='Lumi, observa lo que tienes delante y dime cuántas personas ves y qué están haciendo.'
const p=groundedFreshScenePrompt(q,false,one)
assert.ok(p.endsWith('Pregunta del usuario: '+q))
assert.match(p,/único instante/)
assert.match(p,/No supongas personas al fondo/)
assert.match(p,/no inventes nombres de marcas/)
assert.match(p,/detectaron 1 rostro visible/)
assert.doesNotMatch(p,/NASA|Atlanta|RLW|hijo|hija/)
assert.doesNotMatch(p,/tres personas en el encuadre/)
const noDetector=groundedFreshScenePrompt(q,false,null)
assert.doesNotMatch(noDetector,/detectaron .*rostros/)
assert.match(noDetector,/no fuerces un número/i)
assert.match(groundedFreshScenePrompt(q,true,two),/reconsidera la imagen actual/)

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const app=read('src/App.tsx')
const launcher=read('INICIAR_LUMIA_ASUS_NEXT_QA.cmd')
const daily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const parser=read('src/lib/vision-voice-grounding-vi032b.ts')
const bridge=read('bridge/ollama.mjs')

assert.match(app,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B/)
assert.match(app,/groundedFreshScenePrompt\(said,voiceIntent==='visual-correction',liveFrame\.sameFrameFace\)/)
assert.match(app,/freshCameraScenePrompt\(said,voiceIntent==='visual-correction'\)/)
assert.match(app,/await activeVisionCapture\.current\?\.\(\)/)
assert.match(app,/if\(stale\(\)\)return/)
assert.match(launcher,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B=1/)
assert.doesNotMatch(daily,/VITE_LUMIA_VISION_COUNT_GROUNDING_VI042B/)
assert.match(parser,/observa\|mira\|describe/)
assert.match(bridge,/\/api\/chat/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/Avoid echoing the previous photo description from text history/)
assert.doesNotMatch(app,/faceCount\s*===?\s*personCount/)
assert.doesNotMatch(p,/data:image|base64|photo-one/)
console.log('VI-04.2B PASS: prompt uses exact JPEG CPU evidence only as advice, no imaginary background people or hard count, NEXT-only')
