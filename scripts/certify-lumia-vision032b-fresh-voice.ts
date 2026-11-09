import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {classifyFreshCameraSpeech,freshCameraScenePrompt} from '../src/lib/vision-voice-grounding-vi032b'

for (const q of [
  'Lumia, que estás viendo.',
  'Ahora que veas Lumia.',
  'Y ahora que está viendo, Lumi.',
  'Lumi, ¿Qué es ahora?',
  'Lumi, ¿qué más estás viendo?',
  '¿Qué hay ahora en la cámara?',
  'Lumi, mira ahora.',
  '¿Qué personas ves ahora?',
]) {
  assert.equal(classifyFreshCameraSpeech(q),'fresh-scene','fresh: '+q)
}
for (const q of [
  'Lumi, está, está es mi hijo el frente de la imagen, ¿por qué no logras verlo?',
  'Y me revisar nuevamente, porque la cámara está viendo a mí y a mi hijo.',
  'Lumi, vuelve a revisar la imagen.',
  'Mira de nuevo a las personas frente a la cámara.',
]) {
  assert.equal(classifyFreshCameraSpeech(q),'visual-correction','correction: '+q)
}
for (const q of [
  'Lumi, ¿qué cambió en Github?',
  'Explícame cómo funciona un inversor',
  '¿Qué aparece en esa foto de antes?',
  '¿Cuánto falta para la reunión?',
  '',
]) {
  assert.equal(classifyFreshCameraSpeech(q),'none','must not wake camera: '+q)
}

const p=freshCameraScenePrompt('¿Qué ves ahora?',true)
assert.match(p,/fotograma NUEVO/)
assert.match(p,/todo el encuadre/)
assert.match(p,/figuras humanas/)
assert.match(p,/incluido un menor/)
assert.match(p,/NO prueba/)
assert.match(p,/NASA NO implica uniforme/)

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const launcher=read('INICIAR_LUMIA_ASUS_VISION_REVISAR_VI032B.cmd')
assert.match(launcher,/VITE_LUMIA_VISION_FRESH_VOICE_VI032B=1/)
assert.match(launcher,/INICIAR_LUMIA_ASUS_SENTINEL_CPU_2B_VI032\.cmd/)
assert.match(ui,/onRegisterActiveCapture/)
assert.match(ui,/captureForVoiceRef\.current=\(\)=>/)
assert.match(ui,/if\(!activeRef\.current\)return null/)
assert.match(ui,/const image=takeActiveFrame\(\)/)
assert.match(ui,/onRegisterActiveCapture\(null\)/)
assert.match(app,/VISION_FRESH_VOICE_VI032B_ENABLED/)
assert.match(app,/classifyFreshCameraSpeech\(said\)/)
assert.match(app,/activeVisionCapture\.current\?\.\(\)/)
assert.match(app,/recentActiveVisionFrame\(true,rawLiveFrame\)/)
assert.match(app,/freshSceneRequested/)
assert.match(app,/!freshSceneRequested && !image && !cameraRequested/)
assert.match(app,/attachedJPEG:Boolean\(liveFrame\)/)
assert.match(app,/frameAgeMs:liveFrame/)
assert.match(app,/camera-not-active/)
assert.match(app,/La visión activa está apagada o terminó su sesión/)
assert.match(app,/freshCameraScenePrompt\(said,voiceIntent==='visual-correction'\)/)
assert.match(app,/onRegisterActiveCapture=\{registerActiveVisionCapture\}/)
assert.match(app,/activeVisionCapture\.current=null/)
assert.doesNotMatch(ui,/getUserMedia\(/)
assert.doesNotMatch(launcher,/ollama (?:pull|rm|create|stop)/)
console.log('VI-03.2B PASS: Whisper scene phrases route to fresh authorized JPEG, expired sessions fail closed, 2B preserved')
