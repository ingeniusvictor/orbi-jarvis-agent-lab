import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  parseLumiaCameraIntent,cameraVisionPrompt,captureLumiaAuthorizedStill,
} from '../src/lib/vision-camera-vi02'
import {buildLumiaSkillRegistry} from '../bridge/orbia/skill-registry-skill01.mjs'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const positive=[
  'Lumi, mira esto.',
  'Lumia, mira aquí.',
  'Lumi, puedes mirar esto?',
  'Lumia, ¿qué tengo en la mano?',
  'Lumi, ¿qué ves en la cámara?',
  'Lumi, lee esta etiqueta.',
  'Lumi, revisa este papel.',
  'Lumi, toma una foto con la cámara.',
  'Lumi, quiero que observes lo que tengo.',
  'Lumi, de qué color es este objeto?',
]
for(const said of positive){
  const result=parseLumiaCameraIntent(said)
  assert.equal(result?.kind,'camera-still',said)
  assert.ok(result?.question?.length,said)
}
const negative=[
  'Lumi, cómo funciona la cámara?',
  'Lumi, puedes activar la cámara?',
  'Lumi, no mires esto.',
  'Lumi, mira mi pantalla.',
  'Lumi, captura un video.',
  'Lumi, explícame cómo analizar imágenes.',
  'Lumi, dame un ejemplo de visión artificial.',
  'Hola Lumi, ¿cómo estás?',
  'Lumi, ¿cómo te ves hoy?',
  'Lumi, recuerda lo que vimos ayer.',
  'Lumi, ¿puedes mirar un video?',
  'Lumi, mira esta página web.',
  'Lumi, ¿qué ves en mi monitor?',
  'Mi hijo dice Lumi mira esto.',
  'Lumi, abre Blender y mira esto en pantalla.',
  'Si yo digo mira esto, qué pasa?',
]
for(const said of negative)assert.equal(parseLumiaCameraIntent(said),null,
  'Never activate webcam from non-authorized/desktop/quoted request: '+said)
assert.match(cameraVisionPrompt('¿Qué tengo en la mano?'),/imagen puntual capturada/)
assert.match(cameraVisionPrompt('¿Qué tengo en la mano?'),/Diferencia observaciones de hipótesis/)
assert.doesNotMatch(cameraVisionPrompt('mira esto'),/video continuo/)

const fakeVideo={videoWidth:1280,videoHeight:720,readyState:4} as HTMLVideoElement
let leases=0,acquires=0,releases=0,frames=0
const input={mimeType:'image/jpeg' as const,data:'base64-datos-no-registrables'}
const deps={
  acquire:async()=>{acquires++;leases++;return fakeVideo},
  release:()=>{leases--;releases++},
  waitReady:async(_video:HTMLVideoElement,_cancel:()=>boolean)=>{},
  prepare:(_video:HTMLVideoElement)=>{frames++;return input},
}
assert.deepEqual(await captureLumiaAuthorizedStill(()=>false,deps),input)
assert.deepEqual({acquires,releases,leases,frames},
  {acquires:1,releases:1,leases:0,frames:1},
  'Webcam must close before returning the JPEG for Ollama')
let stale=true
await assert.rejects(()=>captureLumiaAuthorizedStill(()=>stale,deps),/cancelada/)
assert.equal(acquires,1,'A cancelled user turn must not request webcam access')
stale=false
let makeStale=false
const interrupted={
  ...deps,
  waitReady:async()=>{makeStale=true},
}
await assert.rejects(()=>captureLumiaAuthorizedStill(()=>makeStale,interrupted),/cancelada/)
assert.equal(leases,0)
assert.equal(releases,2)
assert.equal(frames,1,'Never encode a frame from cancelled capture')
const denied={
  ...deps,
  acquire:async():Promise<HTMLVideoElement>=>{throw new Error('NotAllowedError')},
}
await assert.rejects(()=>captureLumiaAuthorizedStill(()=>false,denied),/NotAllowedError/)
assert.equal(leases,0,'No phantom camera lease on denied browser permission')
const failedEncode={
  ...deps,
  prepare:():never=>{throw new Error('JPEG failed')},
}
await assert.rejects(()=>captureLumiaAuthorizedStill(()=>false,failedEncode),/JPEG failed/)
assert.equal(leases,0,'The camera must close even when JPEG encoding fails')

// Concurrency: the second owner request may not trigger another getUserMedia.
let resolveAcquire!:(video:HTMLVideoElement)=>void
const gate=new Promise<HTMLVideoElement>(resolve=>{resolveAcquire=resolve})
let finishFirst=0
const concurrent={
  ...deps,
  acquire:()=>gate,
  release:()=>{finishFirst++},
}
const first=captureLumiaAuthorizedStill(()=>false,concurrent)
await assert.rejects(
  ()=>captureLumiaAuthorizedStill(()=>false,concurrent),/Ya estoy capturando/)
resolveAcquire(fakeVideo)
await first
assert.equal(finishFirst,1,'Only one camera lease permitted at a time')

// PH-04.8 remains the same, and visual-only turns must never slow down
// every spoken turn or reconfigure Whisper, Kokoro or a second Ollama provider.
const app=read('src/App.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const camera=read('src/lib/camera.ts')
const photo=read('src/lib/visual-input.ts')
const bridge=read('bridge/ollama.mjs')
const launcher=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const skill=read('bridge/orbia/skill-registry-skill01.mjs')
assert.match(app,/const CAMERA_VISION_VI02_ENABLED = usingBridge/)
assert.match(app,/parseLumiaCameraIntent\(said\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,route.resolution\)/)
assert.match(app,/s\.setLooking\('VISIÓN LOCAL · UNA FOTO SOLICITADA'\)/)
assert.match(app,/s\.setLooking\(null\)/)
assert.match(app,/cameraCaptureOwner\.current===turnId/)
assert.match(app,/cameraVisionPrompt\(cameraIntent\?\.question \?\? said\)/)
assert.match(app,/}, visualImage\)/)
assert.match(app,/onCaptureCamera=\{submitCamera\}/)
assert.match(app,/const avatarAction = AVATAR_PH04_ENABLED && !visualImage && !captureFailure/)
assert.match(composer,/cameraAvailable && !translateEnabled/)
assert.match(composer,/onClick=\{\(\) => onCaptureCamera\?\.\(\)\}/)
assert.match(composer,/aria-label=\{cameraCapturing \?/)
assert.match(composer,/disabled=\{cameraCapturing \|\| busy \|\| preparing \|\| recording \|\| !available\}/)
const photoIndex=composer.indexOf("className={'lumia-composer-icon-button lumia-composer-attach'")
const cameraIndex=composer.indexOf('className={\'lumia-composer-icon-button lumia-composer-camera\'')
const micIndex=composer.indexOf("className={'lumia-composer-icon-button lumia-composer-dictate'")
assert.ok(photoIndex>=0&&photoIndex<cameraIndex&&cameraIndex<micIndex,
  'The camera must live with photo controls, not among voice buttons')
assert.match(photo,/export function prepareVisualCameraFrame/)
assert.match(photo,/MAX_VISUAL_PAYLOAD_CHARS/)
assert.match(photo,/ctx\.drawImage\(video,0,0,width,height\)/)
assert.match(camera,/stream\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/)
assert.match(bridge,/if \(image && process\.env\.ORBIA_LUMIA_VISION_ENABLED !== '1'\)/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(launcher,/VITE_LUMIA_VISION_CAMERA_VI02=1/)
assert.match(launcher,/ORBIA_LUMIA_VISION_CAMERA_VI02=1/)
assert.match(skill,/entry\('vision-camera', 'Cámara puntual autorizada', 'VISION-02'/)
const voiceProbe=()=>({stt:{localAvailable:false},tts:{localAvailable:false}})
const env={
  ORBIA_BRAIN_PROVIDER:'ollama',
  ORBIA_LUMIA_VISION_ENABLED:'1',
  ORBIA_LUMIA_VISION_CAMERA_VI02:'1',
}
const enabled=buildLumiaSkillRegistry({env,voiceProbe})
assert.equal(enabled.capabilities.find(x=>x.id==='vision-camera')?.state,'experimental')
const disabled=buildLumiaSkillRegistry({
  env:{...env,ORBIA_LUMIA_VISION_CAMERA_VI02:'0'},voiceProbe,
})
assert.equal(disabled.capabilities.find(x=>x.id==='vision-camera')?.state,'disabled')
console.log('VISION-02 PASS: explicit camera intent, privacy/no persistence, one-time lease and cancellation, VI-01 JPEG and local Ollama route, normal voice unchanged')
