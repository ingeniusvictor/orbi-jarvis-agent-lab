/**
 * VISION-02: one explicit owner-approved camera still for LUMIA's local
 * multimodal Ollama route. No continuous camera/video, no automatic polling,
 * no disk persistence, no upload beyond the configured localhost bridge.
 *
 * The source camera is already ref-counted and shared with the legacy hands
 * feature. This module acquires/relinquishes exactly its own lease.
 */
import * as camera from './camera'
import {prepareVisualCameraFrame,DEFAULT_VISION_RESOLUTION,type LocalVisualImage,type VisionResolution} from './visual-input'

const normalize=(value:string)=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()

export type LumiaVisionIntent={kind:'camera-still';question:string}

/** Explicit physical-scene questions only. Never enable vision on general chat. */
export function parseLumiaCameraIntent(utterance:string):LumiaVisionIntent|null {
  const raw=normalize(utterance)
  const said=raw.replace(/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:lumi|lumia|lumi a|jarvis)\b\s*/,'')
  if (!said) return null
  // "No mires", hypotheticals, app/screen queries and camera-capability
  // questions must not turn on a physical webcam.
  if (/^(?:no|nunca|sin|como|por que|para que|si yo|si te|cuando|explicame|dime como|puedes activar la camara)\b/.test(said) ||
      /\b(?:pantalla|escritorio|monitor|navegador|pagina web|sitio web|youtube|video|grabacion|historico|historial)\b/.test(said) ||
      /\b(?:no abras|no mires|sin encender|sin abrir)\b/.test(said)) return null

  const direct =
    /^(?:(?:puedes|podrias|me puedes|me podrias|quiero que|necesito que|por favor)\s+)*(?:mira|mires|mirame|mirar|observa|observes|observame|observar|examina|examines|examinar|ve|ver|revisa|revises|revisar|analiza|analices|analizar)\s+(?:esto|aqui|este objeto|esta cosa|esta etiqueta|este papel|esta carta|lo que tengo|lo que sostengo|lo que hay|lo que estoy mostrando|mi mano|mis manos|lo que esta frente a (?:mi|la camara))\b/.test(said) ||
    /^(?:(?:puedes|podrias|me puedes|me podrias)\s+)?(?:decirme|decir|identificar|leer|describir|explicar|analizar)\s+(?:que|qué|lo que)\s+(?:tengo|hay|ves|estoy mostrando)\b/.test(said) ||
    /^(?:que|cual|de que color)\s+(?:es|ves|tengo|hay|estoy sosteniendo|estoy mostrando)\b.*\b(?:mano|manos|camara|frente|sosteniendo|mostrando|objeto|esto)\b/.test(said) ||
    /^(?:que|cuales)\s+(?:ves|observas)\s+(?:(?:en|por|con)\s+)?(?:la camara|esto|aqui|frente a ti|frente a mi)\b/.test(said) ||
    /^(?:lee|leeme|leas|mira|revisa)\s+(?:esta|este)\s+(?:etiqueta|papel|texto|envase|documento|letrero)\b/.test(said) ||
    /^(?:saca|toma|haz|captura)\s+(?:una|la)?\s*(?:foto|fotografia|imagen)\s+(?:con|de|desde)\s+(?:la|mi)\s+camara\b/.test(said)
  if (!direct) return null
  return {
    kind:'camera-still',
    question: /^((?:mira|mirame|observa|examina|revisa|analiza)\s+(?:esto|aqui))$/.test(said)
      ? 'Describe en español lo que aparece en esta imagen. Si algo no se distingue, dilo.'
      : utterance.trim(),
  }
}

export function cameraVisionPrompt(question:string):string{
  return 'Analiza exclusivamente esta imagen puntual capturada con permiso del usuario. '+
    'Responde en español a esta solicitud: '+question.trim()+
    '. No supongas movimiento ni imágenes anteriores. Diferencia observaciones de hipótesis.'
}

type CameraCaptureDeps={
  acquire:()=>Promise<HTMLVideoElement>
  release:()=>void
  prepare:(video:HTMLVideoElement,edge?:VisionResolution)=>LocalVisualImage
  waitReady:(video:HTMLVideoElement,isStale:()=>boolean)=>Promise<void>
}
async function waitCameraFrame(video:HTMLVideoElement,isStale:()=>boolean):Promise<void>{
  const deadline=Date.now()+3500
  while(video.videoWidth===0 || video.videoHeight===0 || video.readyState<2){
    if(isStale())throw new Error('Captura de cámara cancelada.')
    if(Date.now()>deadline)throw new Error('La cámara no entregó una imagen a tiempo.')
    await new Promise<void>(resolve=>setTimeout(resolve,65))
  }
}
const defaultCapture:CameraCaptureDeps={
  acquire:camera.holdCamera,
  release:camera.releaseCamera,
  prepare:prepareVisualCameraFrame,
  waitReady:waitCameraFrame,
}
let captureInFlight=false

/**
 * Only call after a deliberate owner action. As soon as the video frame has
 * been copied into a bounded JPEG, release the camera BEFORE asking Ollama.
 * A superseded turn discards the image without sending it.
 */
export async function captureLumiaAuthorizedStill(
  isStale:()=>boolean=()=>false,
  deps:CameraCaptureDeps=defaultCapture,
  maxEdge:VisionResolution=DEFAULT_VISION_RESOLUTION,
):Promise<LocalVisualImage>{
  if(captureInFlight)throw new Error('Ya estoy capturando una imagen de cámara.')
  captureInFlight=true
  let acquired=false
  try{
    if(isStale())throw new Error('Captura de cámara cancelada.')
    const video=await deps.acquire()
    acquired=true
    if(isStale())throw new Error('Captura de cámara cancelada.')
    await deps.waitReady(video,isStale)
    if(isStale())throw new Error('Captura de cámara cancelada.')
    const image=deps.prepare(video,maxEdge)
    if(isStale())throw new Error('Captura de cámara cancelada.')
    return image
  }finally{
    if(acquired)deps.release()
    captureInFlight=false
  }
}
