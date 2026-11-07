import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  predominantlyDarkCameraSignal,connectedOrVirtualCameraHint,
} from '../src/lib/vision-camera-signal-vi022'
import * as camera from '../src/lib/camera'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const pixels=new Uint8ClampedArray(48*27*4)
for(let i=3;i<pixels.length;i+=4)pixels[i]=255
// Sparse white center logo over black: the Phone Link privacy placeholder
// seen in the actual ASUS screenshot, not a real person/object image.
for(let i=0;i<28;i++){
 const n=(220+i)*4
 pixels[n]=pixels[n+1]=pixels[n+2]=255
}
assert.equal(predominantlyDarkCameraSignal(pixels),true)
assert.equal(predominantlyDarkCameraSignal(new Uint8ClampedArray()),false)
for(let i=0;i<pixels.length;i+=4){
 pixels[i]=118;pixels[i+1]=168;pixels[i+2]=210
}
assert.equal(predominantlyDarkCameraSignal(pixels),false,
 'Normal lit webcam must not get a black-source warning')
assert.match(connectedOrVirtualCameraHint('Windows Virtual Camera')??'',/virtual/)
assert.match(connectedOrVirtualCameraHint('Mobile Device Camera')??'',/virtual/)
assert.match(connectedOrVirtualCameraHint('OBS Virtual Camera')??'',/virtual/)
assert.equal(connectedOrVirtualCameraHint('Integrated Webcam'),null)

// A safe injected browser mock verifies that choosing a source reaches
// getUserMedia through exact deviceId constraints. No real camera, no IDs
// persisted to disk, no credential/attachment upload in CI.
let stopped=0
const opened:Array<string|null>=[]
const tracks:Array<{deviceId:string;label:string}>=[
 {deviceId:'integrated-id',label:'Integrated Camera'},
 {deviceId:'phone-id',label:'Mobile Device Camera'},
]
const tracksFor=(id:string)=>{
 const track={
  label:tracks.find(d=>d.deviceId===id)?.label??'Camera',
  getSettings:()=>({deviceId:id}),
  stop:()=>{stopped++},
 }
 return {getVideoTracks:()=>[track],getTracks:()=>[track]}
}
const navigatorMock={
 mediaDevices:{
  enumerateDevices:async()=>[
   {deviceId:'microphone-id',label:'Microphone',kind:'audioinput'},
   ...tracks.map(t=>({...t,kind:'videoinput'})),
  ],
  getUserMedia:async(c:{video:{deviceId?:{exact:string}}})=>{
   const id=c.video.deviceId?.exact??'integrated-id'
   opened.push(c.video.deviceId?.exact??null)
   return tracksFor(id)
  },
 },
}
Object.defineProperty(globalThis,'navigator',{
 configurable:true,value:navigatorMock,
})
Object.defineProperty(globalThis,'document',{
 configurable:true,
 value:{createElement:()=>({
  srcObject:null,autoplay:false,muted:false,playsInline:false,
  play:async()=>{},pause:()=>{},
 })},
})

const available=await camera.listCameraDevices()
assert.deepEqual(available,tracks)
assert.equal(camera.getPreferredCameraDeviceId(),null)
camera.setPreferredCameraDeviceId('phone-id')
assert.equal(camera.getPreferredCameraDeviceId(),'phone-id')
await camera.holdCamera()
assert.equal(opened[0],'phone-id')
assert.equal(camera.getCurrentCameraSource()?.label,'Mobile Device Camera')
assert.equal(camera.getLastCameraSource()?.label,'Mobile Device Camera')
assert.throws(()=>camera.setPreferredCameraDeviceId('integrated-id'),
 /No puedo cambiar de cámara/)
camera.releaseCamera()
assert.ok(stopped>0,'Releasing last holder stops underlying video track')
camera.setPreferredCameraDeviceId('integrated-id')
await camera.holdCamera()
assert.equal(opened[1],'integrated-id')
assert.equal(camera.getCurrentCameraSource()?.label,'Integrated Camera')
camera.releaseCamera()
camera.setPreferredCameraDeviceId(null)
await camera.holdCamera()
assert.equal(opened[2],null,'Default device should omit exact deviceId')
camera.releaseCamera()
assert.equal(camera.diag.holders,0)
assert.equal(camera.diag.open,false)

const view=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const cameraSource=read('src/lib/camera.ts')
const style=read('src/index.css')
const workflow=read('.github/workflows/lumia-vision022-camera-source.yml')
assert.match(view,/camera\.setPreferredCameraDeviceId\(deviceChoice\|\|null\)/)
assert.match(view,/camera\.listCameraDevices\(\)/)
assert.match(view,/camera\.getCurrentCameraSource\(\)\?\.label/)
assert.match(view,/camera\.getLastCameraSource\(\)\?\.label/)
assert.match(view,/aria-label="Seleccionar cámara de LUMIA"/)
assert.match(view,/Predeterminada de Windows/)
assert.match(view,/devices\.map\(device=>/)
assert.match(view,/inspectCameraSignal\(video\)/)
assert.match(view,/connectedOrVirtualCameraHint\(/)
assert.match(view,/setSignalWarning\(lowSignal\?\?virtualHint\)/)
assert.match(view,/role="status"/)
assert.match(view,/const image=prepareVisualCameraFrame\(video\)/)
assert.match(view,/releaseRef\.current\?\.\(\) \/\/ release BEFORE Ollama/)
assert.match(view,/window\.setTimeout\(\(\)=>\{if\(!cancelled\)closeRef\.current\(\)\},90_000\)/)
assert.match(view,/const expiry=window\.setTimeout/)
assert.match(view,/if\(inspectionTimer\)clearTimeout\(inspectionTimer\)/)
assert.match(view,/Origen usado:/)
assert.match(cameraSource,/deviceId:\{exact:preferredCameraDeviceId\}/)
assert.match(cameraSource,/if\(holders!==0 \|\| stream\)throw/)
assert.match(cameraSource,/let preferredCameraDeviceId:string\|null=null/)
assert.doesNotMatch(cameraSource,/localStorage|indexedDB|sessionStorage/)
assert.match(style,/\.lumia-camera-source select/)
assert.match(style,/\.lumia-camera-signal-warning/)
assert.match(app,/captureLumiaAuthorizedStill\(stale\)/)
assert.match(app,/onCaptured=\{analyzeCameraViewfinderFrame\}/)
assert.match(workflow,/scripts\/certify-lumia-vision022-camera-source\.ts/)
assert.match(workflow,/scripts\/certify-lumia-vision021-viewfinder\.ts/)
assert.match(workflow,/scripts\/certify-lumia-vision02-camera\.ts/)
console.log('VISION-02.2 PASS: active camera label, selectable real/virtual source, black placeholder advisory, permission and shared lease safety, previous visual pipeline intact')
