import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chooseAdaptiveVisionResolution,isPeopleGroupQuestion,shouldOfferGroupDetail} from '../src/lib/vision-routing-amr027'
import {chooseVisionResolution} from '../src/lib/vision-routing-amr024'
import {formatVisionCacheMetrics} from '../bridge/orbia/vision-cache-metrics-amr027.mjs'
import {classifyExistingPhotoFollowup} from '../src/lib/vision-context-amr025'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

const groupQuestions=[
  'Lumi, ¿cuántas personas aparecen y cuántas están de pie?',
  'Lumi, observa esta fotografía. Cuenta las personas de izquierda a derecha, incluyendo a quien esté delante del grupo.',
  'Lumi, cuenta a los hombres de esta foto.',
  'Lumi, ¿qué hay detrás del grupo?',
  'Lumi, describe este grupo de personas.',
  'Lumi, comprueba nuevamente cuántas personas aparecen.',
  'Lumi, ¿cuántas figuras humanas aparecen?',
]
for(const q of groupQuestions){
  assert.equal(isPeopleGroupQuestion(q),true,q)
  assert.deepEqual(chooseAdaptiveVisionResolution(q,'auto',true),{resolution:1024,reason:'group-count-hd'},q)
  assert.equal(chooseAdaptiveVisionResolution(q,'auto',false).resolution,768,q)
  assert.equal(shouldOfferGroupDetail(q,768,true),true,q)
  assert.equal(shouldOfferGroupDetail(q,1024,true),false,q)
  assert.equal(shouldOfferGroupDetail(q,768,false),false,q)
}
// Old AUTO stays exactly as it was when AMR-02.7 has not been selected.
assert.deepEqual(chooseAdaptiveVisionResolution('Cuántas personas hay','auto',false),
  chooseVisionResolution('Cuántas personas hay','auto'))
const generic=[
  'Lumi, describe exactamente lo que aparece en esta imagen y dime qué no puedes distinguir.',
  'Lumi, describe esta foto.',
  'Lumi, ¿qué hay detrás del árbol?',
  'Lumi, ¿cuántas monedas hay?',
]
for(const q of generic){
  assert.equal(isPeopleGroupQuestion(q),false,q)
  assert.equal(chooseAdaptiveVisionResolution(q,'auto',true).resolution,768,q)
}
assert.deepEqual(chooseAdaptiveVisionResolution('¿De qué color es esto?','auto',true),
  {resolution:512,reason:'simple-object'})
assert.deepEqual(chooseAdaptiveVisionResolution('Lumi, lee la etiqueta de este grupo','auto',true),
  {resolution:1024,reason:'ocr'})
// Manual selection wins, even against people groups and OCR.
for(const edge of [512,768,1024] as const){
  assert.deepEqual(chooseAdaptiveVisionResolution('Cuenta las personas',edge,true),
    {resolution:edge,reason:'manual'})
  assert.deepEqual(chooseAdaptiveVisionResolution('Lee la etiqueta del grupo',edge,true),
    {resolution:edge,reason:'manual'})
}
// Asking follow-up on OLD JPEG cannot magically increase its pixel detail:
assert.equal(classifyExistingPhotoFollowup('¿Cuántas personas?',768),'proceed')
assert.equal(shouldOfferGroupDetail('¿Cuántas personas?',768,true),true)
assert.equal(shouldOfferGroupDetail('¿Cuántas personas?',1024,true),false)

assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414}), 'cachedTokens=unavailable')
assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414,prompt_eval_cached_count:null}), 'cachedTokens=unavailable')
assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414,prompt_eval_cached_count:0}), 'cachedTokens=0 cachedShare=0.0%')
assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414,prompt_eval_cached_count:1414}), 'cachedTokens=1414 cachedShare=100.0%')
assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414,prompt_eval_cached_count:707}), 'cachedTokens=707 cachedShare=50.0%')
assert.equal(formatVisionCacheMetrics({prompt_eval_count:0,prompt_eval_cached_count:0}), 'cachedTokens=0 cachedShare=0.0%')
for(const x of [-1,1415,1.5,'not a number']){
  assert.equal(formatVisionCacheMetrics({prompt_eval_count:1414,prompt_eval_cached_count:x}),'cachedTokens=unavailable')
}

const launcher=read('INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd')
const baseline=read('INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd')
assert.match(launcher,/set "VITE_LUMIA_VISION_ADAPTIVE_AMR027=1"/)
assert.match(launcher,/set "ORBIA_LUMIA_VISUAL_CACHE_AMR027=1"/)
assert.match(launcher,/call "%~dp0INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd"/)
assert.doesNotMatch(baseline,/VITE_LUMIA_VISION_ADAPTIVE_AMR027=1|ORBIA_LUMIA_VISUAL_CACHE_AMR027=1/)
assert.doesNotMatch(launcher,/ollama\s+(?:rm|pull|create|stop)|num_gpu|num_batch/i)

const app=read('src/App.tsx')
const view=read('src/ui/LumiaCameraViewfinder.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const bridge=read('bridge/ollama.mjs')
assert.match(app,/const VISION_ADAPTIVE_AMR027_ENABLED = import\.meta\.env\.VITE_LUMIA_VISION_ADAPTIVE_AMR027 === '1'/)
assert.match(app,/chooseAdaptiveVisionResolution\(cameraIntent\?\.question \?\? said,visionChoice,true\)/)
assert.match(app,/shouldOfferGroupDetail\(visualQuestion,frameSource\.resolution,/)
assert.match(app,/VISION_ADAPTIVE_AMR027_ENABLED && visionAutoEnabled/)
assert.match(app,/contextAction==='offer-high-resolution' \|\| groupUpgrade/)
assert.match(app,/setVisualDetailPurpose\(detailPurpose\)/)
assert.match(app,/visualDetailPurpose=\{visualDetailPurpose\}/)
assert.match(app,/const highResolution=await prepareVisualImage\(selected\.file,1024\)/)
assert.match(app,/setCameraPreviewOpen\(true\)/)
assert.match(composer,/chooseAdaptiveVisionResolution\(question,visionAutoAvailable && visionAutoEnabled \? 'auto' : visionResolution,true\)/)
assert.match(view,/visualDetailPurpose==='count'/)
assert.match(view,/Reanalizar grupo a 1024 px/)
assert.match(view,/Volver a encuadrar grupo a 1024 px/)
assert.match(view,/onClick=\{onRequestDetailedReanalysis\}/)
assert.match(bridge,/formatVisionCacheMetrics\(packet\)/)
assert.match(bridge,/process\.env\.ORBIA_LUMIA_VISUAL_CACHE_AMR027==='1'/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/think: false/)
assert.doesNotMatch(read('bridge/orbia/vision-cache-metrics-amr027.mjs'),/writeFile|localStorage|indexedDB|getUserMedia|crypto\.createHash/)
console.log('AMR-02.7 PASS: opt-in high-density 1024, manual override, consent for old 768 JPEG, cache absent != zero and original Ollama image path')
