import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DEFAULT_VISION_RESOLUTION,VISION_RESOLUTION_CHOICES,visionResolutionEdges,scaleVisualDimensions} from '../src/lib/visual-input'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const codec=read('src/lib/visual-input.ts')
const camera=read('src/lib/vision-camera-vi02.ts')
const viewfinder=read('src/ui/LumiaCameraViewfinder.tsx')
const composer=read('src/ui/LumiaComposer.tsx')
const app=read('src/App.tsx')
const css=read('src/index.css')
const bridge=read('bridge/ollama.mjs')
const profile=read('bridge/orbia/vision-profile-amr021.mjs')

// Trial is explicit, deterministic and defaults to the exact old 1024.
assert.deepEqual(VISION_RESOLUTION_CHOICES,[512,768,1024])
assert.equal(DEFAULT_VISION_RESOLUTION,1024)
assert.deepEqual(visionResolutionEdges(512),[512])
assert.deepEqual(visionResolutionEdges(768),[768,640,512])
assert.deepEqual(visionResolutionEdges(1024),[1024,800,640,512])
assert.throws(()=>visionResolutionEdges(256 as 512),/no admitida/)

for(const max of VISION_RESOLUTION_CHOICES){
  const landscape=scaleVisualDimensions(1600,1200,max)
  assert.deepEqual(landscape,{width:max,height:Math.round(max*.75)})
  const portrait=scaleVisualDimensions(1200,1600,max)
  assert.deepEqual(portrait,{width:Math.round(max*.75),height:max})
  assert.deepEqual(scaleVisualDimensions(320,240,max),{width:320,height:240},
    'Never upscale a photo')
}
assert.throws(()=>scaleVisualDimensions(0,100,1024),/no válidas/)
assert.throws(()=>scaleVisualDimensions(1000,1000,99999),/no admitida/)

// One exact JPEG is created only after deliberate user selection/capture.
// The original privacy boundary and no-echo memory remain untouched.
assert.match(codec,/export async function prepareVisualImage\(file: File, maxEdge:VisionResolution=DEFAULT_VISION_RESOLUTION\)/)
assert.match(codec,/export function prepareVisualCameraFrame\(video:HTMLVideoElement,maxEdge:VisionResolution=DEFAULT_VISION_RESOLUTION\)/)
assert.equal((codec.match(/for \(const edge of visionResolutionEdges\(maxEdge\)\)/g)||[]).length,2)
assert.match(codec,/reportPreparedFrame\('file'/)
assert.match(codec,/reportPreparedFrame\('camera'/)
assert.doesNotMatch(codec,/console\.(?:log|info|warn)\([^\n]*\.data/)
assert.match(camera,/const image=deps\.prepare\(video,maxEdge\)/)
assert.match(camera,/if\(acquired\)deps\.release\(\)/)
assert.match(viewfinder,/prepareVisualImage\(file,maxEdge\)/)
assert.match(viewfinder,/prepareVisualCameraFrame\(video,visionResolution\)/)
assert.match(viewfinder,/selectedFile\.current=file/)
assert.match(viewfinder,/selectFile\(selectedFile\.current,edge\)/)
assert.match(viewfinder,/aria-label="Resolución máxima para la próxima fotografía"/)
assert.match(composer,/prepareVisualImage\(photo,visionResolution\)/)
assert.match(composer,/aria-label="Resolución máxima de fotografía adjunta"/)
assert.match(app,/useState<VisionResolution>\(DEFAULT_VISION_RESOLUTION\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,visionResolution\)/)
assert.match(app,/visionResolution=\{visionResolution\}/)
assert.match(app,/onVisionResolutionChange=\{setVisionResolution\}/)
assert.match(css,/\.lumia-camera-resolution-selector/)
assert.match(css,/\.lumia-composer-resolution/)
assert.match(bridge,/inputTokens=/)
assert.match(bridge,/outputTokens=/)
assert.match(bridge,/doneReason=/)
assert.match(profile,/name === 'qwen3\.5:4b-vision4096'/)
// Don't modify GPU split, batch size, prompt cache, or auto-trigger a camera.
assert.doesNotMatch(codec,/num_gpu|num_batch|localStorage|sessionStorage/)
assert.doesNotMatch(viewfinder,/localStorage|sessionStorage|setInterval/)
assert.doesNotMatch(composer,/localStorage|sessionStorage/)
console.log('AMR-02.3 PASS: owner-controlled 512/768/1024 benchmark, 1024 default, camera/file paths, metadata-only logging, no automatic resizing/retries, vision4096 untouched')
