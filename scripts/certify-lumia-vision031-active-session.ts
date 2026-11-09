import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ACTIVE_VISION_SAMPLE_MS,
  ACTIVE_VISION_MAX_SESSION_MS,
  ACTIVE_VISION_MAX_FRAME_AGE_MS,
  isActiveVisionQuestion,
  asksActiveVisionChange,
  recentActiveVisionFrame,
  type ActiveVisionFrame,
} from '../src/lib/vision-active-vi031'

assert.equal(ACTIVE_VISION_SAMPLE_MS, 12_000)
assert.equal(ACTIVE_VISION_MAX_SESSION_MS, 180_000)
assert.equal(ACTIVE_VISION_MAX_FRAME_AGE_MS, 20_000)
for(const phrase of [
  'Lumi, ¿qué ves ahora?',
  'Lumi, ¿qué estás viendo?',
  'Lumi, mira esto.',
  'Lumi, ¿qué cambió?',
  '¿Sigue igual?',
  'Lumi, ¿cuántas personas ves?',
  '¿De qué color es la camisa?',
  '¿Qué hay detrás de la persona?',
  'Lumi, describe la escena.',
]){
  assert.equal(isActiveVisionQuestion(phrase),true,'expected vision: '+phrase)
}
for(const phrase of [
  'Lumi, ¿qué hora es?',
  'Lumi, ¿cómo estás?',
  '¿Qué pasó ayer en las noticias?',
  '¿Cómo funciona un inversor?',
  '¿Qué cambió en GitHub?',
  '',
]){
  assert.equal(isActiveVisionQuestion(phrase),false,'unexpected vision: '+phrase)
}
assert.equal(asksActiveVisionChange('Lumi, ¿qué cambió?'),true)
assert.equal(asksActiveVisionChange('¿Sigue igual?'),true)
assert.equal(asksActiveVisionChange('Lumi, ¿qué ves ahora?'),false)
const frame:ActiveVisionFrame={
  image:{mimeType:'image/jpeg',data:'test-jpeg'},
  resolution:768,
  capturedAt:1_000_000,
}
assert.equal(recentActiveVisionFrame(true,frame,1_000_000),frame)
assert.equal(recentActiveVisionFrame(true,frame,1_020_000),frame)
assert.equal(recentActiveVisionFrame(true,frame,1_020_001),null)
assert.equal(recentActiveVisionFrame(false,frame,1_000_100),null)
assert.equal(recentActiveVisionFrame(true,frame,999_999),null)
assert.equal(recentActiveVisionFrame(true,null),null)

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const app=read('src/App.tsx')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const launcher=read('INICIAR_LUMIA_ASUS_VISION_ACTIVA_VI031.cmd')
assert.match(launcher,/set "VITE_LUMIA_VISION_ACTIVE_VI031=1"/)
assert.match(launcher,/INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030\.cmd/)
assert.match(app,/VISION_ACTIVE_VI031_ENABLED = import\.meta\.env\.VITE_LUMIA_VISION_ACTIVE_VI031 === '1'/)
assert.match(app,/isActiveVisionQuestion\(said\)/)
assert.match(app,/recentActiveVisionFrame\(true,activeVisionLatest\.current\)/)
assert.match(app,/let visualImage=image \?\? liveFrame\?\.image \?\? visualFollowUp\?\.image/)
assert.match(app,/activeVisionAuthorized\.current=false/)
assert.match(app,/activeVisionLatest\.current=null/)
assert.match(app,/onActiveVisionFrame=\{receiveActiveVisionFrame\}/)
assert.match(app,/onAnalyzeLiveFrame=\{analyzeActiveVisionFrame\}/)
assert.match(app,/asksActiveVisionChange\(said\)/)
assert.match(ui,/onClick=\{visionActive\?close:beginActive\}/)
assert.match(ui,/onClick=\{analyzeLiveNow\}/)
assert.match(ui,/onClick=\{close\}/)
assert.match(ui,/visionActiveAvailable/)
assert.match(ui,/lumia-vision-active-bar/)
assert.match(ui,/visibilitychange/)
assert.match(ui,/ACTIVE_VISION_SAMPLE_MS/)
assert.match(ui,/ACTIVE_VISION_MAX_SESSION_MS/)
assert.match(ui,/prepareVisualCameraFrame\(video,effectiveResolution\)/)
assert.match(ui,/onFrameRef\.current\(image,effectiveResolution,Date\.now\(\)\)/)
assert.doesNotMatch(launcher,/ollama (?:pull|rm|stop|create)/)
console.log('VI-03.1 PASS: opt-in bounded webcam snapshots, fresh voice queries, no implicit model polling and fail-closed stop/expiry')
