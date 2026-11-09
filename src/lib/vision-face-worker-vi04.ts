/**
 * VISION-04A worker. It receives transferable ImageBitmaps from the existing
 * authorized webcam preview; the worker itself has NO camera or microphone.
 * Model + WASM execute locally on CPU. No image or template is persisted.
 */
import {FaceDetector,FilesetResolver} from '@mediapipe/tasks-vision'
import {normalizeDetectedFaces,type FaceBox} from './vision-faces-vi04'

type Command=
  | {type:'INIT'}
  | {type:'FRAME';bitmap:ImageBitmap;timestampMs:number;sequence:number}
  | {type:'STOP'}
type WorkerReply=
  | {type:'READY'}
  | {type:'RESULT';sequence:number;faces:FaceBox[];elapsedMs:number}
  | {type:'ERROR';message:string}

const respond=(msg:WorkerReply)=>self.postMessage(msg)
let detector:FaceDetector|null=null
let lastStamp=0
let stopped=false
let initialising=false

async function initialise():Promise<void>{
  if(initialising||detector||stopped)return
  initialising=true
  try{
    const vision=await FilesetResolver.forVisionTasks('/mediapipe')
    if(stopped)return
    const created=await FaceDetector.createFromOptions(vision,{
      baseOptions:{
        modelAssetPath:'/models/vision/blaze_face_short_range.tflite',
        delegate:'CPU',
      },
      runningMode:'VIDEO',
      minDetectionConfidence:0.55,
      minSuppressionThreshold:0.3,
    })
    if(stopped){created.close();return}
    detector=created
    respond({type:'READY'})
  }catch(err){
    respond({type:'ERROR',message:err instanceof Error?err.message:'No se pudo iniciar MediaPipe facial.'})
  }finally{initialising=false}
}

function processFrame(cmd:Extract<Command,{type:'FRAME'}>):void{
  const bitmap=cmd.bitmap
  try{
    if(stopped||!detector)throw new Error('Detector no inicializado.')
    const started=performance.now()
    const timestampMs=Number.isFinite(cmd.timestampMs)?cmd.timestampMs:started
    lastStamp=Math.max(lastStamp+1,timestampMs)
    const result=detector.detectForVideo(bitmap,lastStamp)
    const faces=normalizeDetectedFaces(result.detections.map(d=>({
      boundingBox:d.boundingBox??undefined,
      categories:d.categories?.map(c=>({score:c.score})),
    })),bitmap.width,bitmap.height)
    respond({type:'RESULT',sequence:cmd.sequence,faces,elapsedMs:Math.round(performance.now()-started)})
  }catch(err){
    respond({type:'ERROR',message:err instanceof Error?err.message:'Falló la detección facial.'})
  }finally{
    bitmap.close() // no frame is ever retained by the worker
  }
}

self.addEventListener('message',(event:MessageEvent<Command>)=>{
  const msg=event.data
  if(msg.type==='STOP'){
    stopped=true
    detector?.close()
    detector=null
    self.close()
  }else if(msg.type==='INIT'){
    void initialise()
  }else if(msg.type==='FRAME'){
    processFrame(msg)
  }
})
