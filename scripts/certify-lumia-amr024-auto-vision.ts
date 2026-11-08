import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chooseVisionResolution,visionSpeechBudget} from '../src/lib/vision-routing-amr024'
import {DEFAULT_VISION_RESOLUTION} from '../src/lib/visual-input'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const app=read('src/App.tsx')
const view=read('src/ui/LumiaCameraViewfinder.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const camera=read('src/lib/vision-camera-vi02.ts')
const bridge=read('bridge/ollama.mjs')
const stable=read('INICIAR_LUMIA_ASUS_VISION4096.cmd')
const pilot=read('INICIAR_LUMIA_ASUS_VISION_AUTO.cmd')

assert.equal(DEFAULT_VISION_RESOLUTION,1024)
const cases=[
  ['Lumi, ¿de qué color es esto?',512,'simple-object'],
  ['Lumi, ¿qué objeto es este?',512,'simple-object'],
  ['Lumi, identifica este objeto.',512,'simple-object'],
  ['Lumi, ¿cuántas personas hay en la foto?',768,'count-or-spatial'],
  ['Lumi, ¿qué hay detrás del grupo?',768,'count-or-spatial'],
  ['Lumi, describe exactamente lo que aparece en esta imagen y dime qué no puedes distinguir.',768,'scene-default'],
  ['Lumi, mira esto.',768,'scene-default'],
  ['Lumi, lee esta etiqueta.',1024,'ocr'],
  ['Lumi, ¿qué dice este texto pequeño?',1024,'ocr'],
  ['Lumi, necesito identificar el número de serie.',1024,'ocr'],
  ['Lumi, ¿cuántos dispositivos hay? Lee también la placa.',1024,'ocr'],
] as const
for(const [question,resolution,reason] of cases){
 const actual=chooseVisionResolution(question,'auto')
 assert.deepEqual(actual,{resolution,reason},question)
}
// Never silently override a real owner choice, even for documents or counts.
for(const resolution of [512,768,1024] as const){
 assert.deepEqual(chooseVisionResolution('Lee esta etiqueta',resolution),
   {resolution,reason:'manual'})
}
assert.throws(()=>chooseVisionResolution('Hello',999 as 512),/no admitida/)
assert.equal(visionSpeechBudget('detallada',true),'')
assert.equal(visionSpeechBudget('breve',false),'')
assert.match(visionSpeechBudget('breve',true),/40 palabras/)
assert.match(visionSpeechBudget('breve',true),/frases completas/)
assert.match(visionSpeechBudget('breve',true),/No inventes conteos/)

// Feature isolation: same exact original launcher if the opt-in one is not used.
assert.match(pilot,/set "VITE_LUMIA_VISION_AUTO_AMR024=1"/)
assert.match(pilot,/call "%~dp0INICIAR_LUMIA_ASUS_VISION4096.cmd"/)
assert.doesNotMatch(stable,/VITE_LUMIA_VISION_AUTO_AMR024=1/)
assert.doesNotMatch(pilot,/ollama\s+(?:pull|rm|create|stop)/i)
assert.match(app,/const VISION_AUTO_AMR024_ENABLED = import\.meta\.env\.VITE_LUMIA_VISION_AUTO_AMR024 === '1'/)
assert.match(app,/useState\(VISION_AUTO_AMR024_ENABLED\)/)
assert.match(app,/visionAutoEnabled && VISION_AUTO_AMR024_ENABLED \? 'auto'/)
assert.match(app,/chooseVisionResolution\(cameraIntent\?\.question \?\? said,visionChoice\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,route\.resolution\)/)
assert.match(app,/visionSpeechBudget\(visionReplyMode,VISION_AUTO_AMR024_ENABLED\)/)
assert.match(app,/first-text/)
assert.equal((app.match(/visionAutoAvailable=\{VISION_AUTO_AMR024_ENABLED\}/g)||[]).length,2)
assert.equal((app.match(/onVisionAutoEnabledChange=\{setVisionAutoEnabled\}/g)||[]).length,2)

assert.match(view,/prepareVisualCameraFrame\(video,effectiveResolution\)/)
assert.match(view,/const effectiveResolution=sceneRoute\.resolution/)
assert.match(view,/aria-pressed=\{visionAutoEnabled\}/)
assert.match(view,/onVisionAutoEnabledChange\(false\)/)
assert.match(view,/onVisionAutoEnabledChange\(true\)/)
assert.match(view,/selectFile\(selectedFile\.current,edge\)/)
assert.match(view,/releaseRef\.current\?\.\(\)/)
assert.match(composer,/prepareVisualImage\(photo,route\.resolution\)/)
assert.match(composer,/onVisionAutoEnabledChange\(false\)/)
assert.match(composer,/onVisionAutoEnabledChange\(true\)/)
assert.match(composer,/disabled=\{preparing \|\| busy \|\| recording\}/)
assert.match(camera,/if\(acquired\)deps\.release\(\)/)

// The native visual inference remains exactly one owner-authorized /api/chat.
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/think: false/)
assert.match(bridge,/inputTokens=/)
assert.match(bridge,/doneReason=/)
assert.doesNotMatch(pilot,/MAX_LOADED_MODELS|NUM_PARALLEL|num_gpu|num_batch/)
assert.doesNotMatch(view,/localStorage|sessionStorage|setInterval\(/)
console.log('AMR-02.4 PASS: conservative AUTO 512/768/1024, OCR priority, manual override, short speech, metadata-only timing, one JPEG and full rollback')
