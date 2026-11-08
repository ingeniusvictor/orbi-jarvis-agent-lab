import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const view=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const photo=read('src/lib/visual-input.ts')
const style=read('src/index.css')
const camera=read('src/lib/camera.ts')
const workflow=read('.github/workflows/lumia-vision021-viewfinder.yml')

// The owner opens a LIVE unprocessed view to align the webcam. The video
// shown must use the SAME HTMLVideoElement that gets encoded to JPEG.
assert.match(view,/className="lumia-camera-viewfinder-video"/)
assert.match(view,/ref=\{videoRef\}/)
assert.match(view,/const video=videoRef\.current/)
assert.match(view,/prepareVisualCameraFrame\(video,visionResolution\)/)
assert.match(view,/video\.srcObject=source/)
assert.match(view,/source=camera\.cameraStream\(\)/)
assert.match(view,/await camera\.holdCamera\(\)/)
assert.match(view,/camera\.releaseCamera\(\)/)
assert.match(view,/await video\.play\(\)/)
assert.match(view,/aria-label="Vista real de la webcam, sin espejo"/)
assert.match(style,/\.lumia-camera-viewfinder-video,[\s\S]*\.lumia-camera-viewfinder-frame/)
assert.match(style,/object-fit: contain/)
assert.match(style,/transform: none !important/)
assert.match(photo,/ctx\.drawImage\(video,0,0,width,height\)/)
assert.doesNotMatch(photo,/ctx\.translate\(width,0\)/)
assert.doesNotMatch(view,/getDisplayMedia|MediaRecorder|toBlob|localStorage|fetch\(/)

// The owner explicitly commits ONE frame. Releasing a camera lease before
// onCaptured is critical: asynchronous Ollama thinking must NOT keep it on.
const capture=view.slice(view.indexOf('  const capture=()=>'),view.indexOf('\n  return ('))
assert.ok(capture.indexOf('prepareVisualCameraFrame(video,visionResolution)')>=0)
assert.ok(capture.indexOf('releaseRef.current?.()') >
  capture.indexOf('prepareVisualCameraFrame(video,visionResolution)'))
assert.ok(capture.indexOf('releaseRef.current?.()') <
  capture.indexOf('onCaptured(image)'))
assert.match(view,/onClick=\{capture\}/)
assert.match(view,/disabled=\{!ready\}/)
assert.match(view,/onClick=\{close\}/)
assert.match(view,/onClick=\{onReopen\}/)
assert.match(view,/if\(cancelled\)\{release\(\);return\}/)
assert.match(view,/window\.setTimeout\(\(\)=>\{if\(!cancelled\)closeRef\.current\(\)\},90_000\)/)
assert.match(view,/window\.clearTimeout\(expiry\)/)
assert.match(view,/if\(held\)\{\s*held=false\s*camera\.releaseCamera\(\)/)
assert.match(view,/releaseRef\.current===release/)
assert.match(view,/EN VIVO · SIN ANALIZAR/)
assert.match(view,/FOTOGRAMA CAPTURADO/)
assert.match(view,/Esto es lo que recibió LUMIA/)
assert.match(view,/Nada se envía hasta capturar/)

// The STILL image is the actual same base64 JPEG passed to Ollama, never a
// continuously refreshed camera, a cropped CSS screenshot, or another frame.
assert.match(view,/data:image\/jpeg;base64,\$\{still\.data\}/)
assert.match(view,/alt="Fotograma exacto de la cámara utilizado/)
assert.match(app,/const \[cameraPreviewOpen,setCameraPreviewOpen\] = useState\(false\)/)
assert.match(app,/const \[cameraStill,setCameraStill\] = useState<LocalVisualImage\|null>\(null\)/)
assert.match(app,/setCameraStill\(visualImage\)/) // voice path
assert.match(app,/const analyzeCameraViewfinderFrame = \(image:LocalVisualImage\) =>/)
assert.match(app,/setCameraStill\(image\)/) // manual button
assert.match(app,/void respond\('Lumi, describe exactamente lo que aparece en esta imagen.*',image,false,true\)/)
assert.match(app,/<LumiaCameraViewfinder/)
assert.match(app,/live=\{cameraPreviewOpen\}/)
assert.match(app,/still=\{cameraStill\}/)
assert.match(app,/onCaptured=\{analyzeCameraViewfinderFrame\}/)
assert.match(app,/onClose=\{closeCameraViewfinder\}/)
assert.match(app,/onReopen=\{recaptureCameraViewfinder\}/)
assert.match(app,/const submitCamera = \(\) => \{/)
const open=app.slice(app.indexOf('  const submitCamera = () => {'),
  app.indexOf('  const closeCameraViewfinder = () => {'))
assert.match(open,/setCameraPreviewOpen\(true\)/)
assert.doesNotMatch(open,/respond\(|captureLumiaAuthorizedStill|cameraVisionPrompt/)
assert.match(composer,/cameraPreviewOpen\?: boolean/)
assert.match(app,/cameraPreviewOpen=\{cameraPreviewOpen\}/)
assert.match(composer,/aria-label=\{cameraCapturing \? 'Capturando una imagen puntual' : cameraPreviewOpen \? 'Cerrar vista previa de cámara'/)

// Existing photograph intake, webcam-by-voice and ordinary fast conversation
// remain separate; no 2nd Ollama session or new npm/3rd-party service.
assert.match(app,/parseLumiaCameraIntent\(said\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,visionResolution\)/)
assert.match(app,/}, visualImage\)/)
assert.match(composer,/onClick=\{\(\) => \(translateEnabled \? audioInput : photoInput\)\.current\?\.click\(\)\}/)
assert.match(camera,/export async function holdCamera/)
assert.match(camera,/export function releaseCamera/)
assert.match(workflow,/scripts\/certify-lumia-vision021-viewfinder\.ts/)
assert.match(workflow,/scripts\/certify-lumia-vision02-camera\.ts/)
assert.match(workflow,/scripts\/certify-lumia-ph048-walk-paths\.ts/)
console.log('VISION-02.1 PASS: real unmirrored viewfinder, bounded camera lease, exact captured JPEG, voice still, manual opt-in, legacy VI-01/02 safe')
