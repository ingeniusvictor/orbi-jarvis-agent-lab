/**
 * VI-05A — independently switchable local CPU Pose Landmarker Lite.
 * Receives resized ImageBitmaps from the existing authorized HTMLVideoElement.
 * No camera permission, upload, Qwen calls, recognition or image persistence.
 */
import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision'
import {summarizeBodyPose,type BodyPoseSummary} from './vision-pose-vi05'

type Command=
  | {type:'INIT'}
  | {type:'FRAME';bitmap:ImageBitmap;timestampMs:number;sequence:number}
  | {type:'STOP'}
type Reply=
  | {type:'READY'}
  | {type:'RESULT';sequence:number;pose:BodyPoseSummary}
  | {type:'ERROR';message:string}

const send=(data:Reply)=>self.postMessage(data)
let landmarker:PoseLandmarker|null=null
let stopped=false
let initialising=false
let lastStamp=0

async function initialise():Promise<void>{
  if(initialising||landmarker||stopped)return
  initialising=true
  try{
    const vision=await FilesetResolver.forVisionTasks('/mediapipe',true)
    if(stopped)return
    const created=await PoseLandmarker.createFromOptions(vision,{
      baseOptions:{
        modelAssetPath:'/models/vision/pose_landmarker_lite.task',
        delegate:'CPU',
      },
      runningMode:'VIDEO',
      numPoses:1,
      minPoseDetectionConfidence:0.60,
      minPosePresenceConfidence:0.60,
      minTrackingConfidence:0.60,
      outputSegmentationMasks:false,
    })
    if(stopped){created.close();return}
    landmarker=created
    send({type:'READY'})
  }catch{
    // Do not log URLs, image data or private messages into the browser.
    send({type:'ERROR',message:'No se pudo cargar el modelo corporal local. Verifica la instalación VI-05A.'})
  }finally{initialising=false}
}

function process(bitmap:ImageBitmap,at:number,sequence:number):void{
  try{
    if(stopped||!landmarker)throw Error('Centinela corporal no inicializado.')
    const started=performance.now()
    lastStamp=Math.max(lastStamp+1,Number.isFinite(at)?at:started)
    const result=landmarker.detectForVideo(bitmap,lastStamp)
    send({type:'RESULT',sequence,
      pose:summarizeBodyPose(result.landmarks,performance.now()-started)})
  }catch{
    send({type:'ERROR',message:'Falló el análisis corporal local.'})
  }finally{
    bitmap.close()
  }
}
self.addEventListener('message',(event:MessageEvent<Command>)=>{
  const cmd=event.data
  if(cmd.type==='STOP'){
    stopped=true
    landmarker?.close()
    landmarker=null
    self.close()
  }else if(cmd.type==='INIT'){
    void initialise()
  }else if(cmd.type==='FRAME'){
    process(cmd.bitmap,cmd.timestampMs,cmd.sequence)
  }
})
