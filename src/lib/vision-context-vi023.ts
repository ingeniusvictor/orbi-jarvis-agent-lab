/**
 * LUMIA VISION-02.3 — ephemeral visual conversation.
 *
 * A previously authorized still may support later questions about THAT SAME
 * frame, without opening a webcam again. The image lives solely inside this
 * browser module's private, in-memory object for at most five minutes.
 * No localStorage, file writes, transcript payloads, external API or replay.
 */
import type {LocalVisualImage} from './visual-input'

export const VISION_CONTEXT_TTL_MS=5*60*1000
export type VisionReplyMode='breve'|'detallada'
export type VisualReference='explicit'|'contextual'

export const visualModeInstruction=(mode:VisionReplyMode):string=>
  mode==='breve'
    ? ' Responde en español de forma breve, idealmente en una o dos frases y hasta 40 palabras. No inventes detalles.'
    : ' Responde en español con detalles útiles pero sin repetir información innecesaria. Explica qué no puedes distinguir.'

export const followupVisionPrompt=(question:string,mode:VisionReplyMode):string=>
  'Pregunta de seguimiento del usuario sobre LA MISMA fotografía adjunta nuevamente en este turno. '+
  'Observa la imagen actual, responde solo lo que permite ver y no supongas que la cámara sigue activa. '+
  'Pregunta: '+question.trim()+'.'+visualModeInstruction(mode)

function clean(value:string):string{
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim()
}
const unrelated=/\b(?:hora|fecha|clima|temperatura|noticias|precio|internet|google|github|ollama|receta|codigo|programar|javascript|musica|youtube|juego|bateria|calendario)\b/
const explicit=/\b(?:foto|fotografia|imagen|captura|fotograma|esa escena|esta escena|la escena|lo que viste|lo que observaste|lo que acabas de ver|la misma imagen|la misma foto|la foto anterior|esa foto)\b/
const sceneWords=/\b(?:objeto|detras|fondo|adelante|arriba|abajo|izquierda|derecha|al lado|persona|personas|hombre|mujer|nino|nina|ninos|ropa|camiseta|vestimenta|colores|color|cabello|manos|mano|cara|rostro|ventana|pared|cortina|mesa|silla|habitacion|figura|letrero|etiqueta|texto|aparece|aparecen|sostiene|llevan|lleva|viste|hay|ahi|eso|ese|esa|aquello)\b/
const questionForm=/^(?:y\s+)?(?:que|cual|cuales|cuantos|cuantas|de que|en que|donde|como|quien|quienes|puedes|podrias|dime|describe|explicame|muestrame|identifica|lee|fijate|y)\b/

/**
 * Only infer a follow-up from obvious scene references. An unrelated request
 * must use the ordinary fast text route, even while the still panel is open.
 * If explicit camera capture is requested, caller gives it priority.
 */
export function classifyVisualFollowUp(text:string):VisualReference|null{
  const said=clean(text)
    .replace(/^(?:(?:hola|oye|ok|okay|hey)\s+)?(?:lumi|lumia|jarvis)\b\s*/,'')
  if(!said || /^(?:no|nunca|sin|cancela|olvida|borra|cierra|descarta)\b/.test(said))return null
  if(unrelated.test(said))return null
  if(explicit.test(said))return 'explicit'
  if(!questionForm.test(said))return null
  if(sceneWords.test(said))return 'contextual'
  return null
}

type ActiveVisualFrame={
  image:LocalVisualImage
  generation:number
  acceptedAt:number
  analyzed:boolean
}
export class EphemeralVisualContext{
  private entry:ActiveVisualFrame|null=null
  private generation=0
  /** Called only when the user has explicitly authorized a still. */
  begin(image:LocalVisualImage,now=Date.now()):number{
    // Replace the prior frame, never concatenate or archive older images.
    this.clear()
    if(image.mimeType!=='image/jpeg'||!image.data)throw new Error('Fotografía no válida.')
    const generation=++this.generation
    this.entry={image,generation,acceptedAt:now,analyzed:false}
    return generation
  }
  confirmAnalyzed(generation:number,now=Date.now()):boolean{
    if(!this.entry || this.entry.generation!==generation || this.expired(now))return false
    this.entry.analyzed=true
    return true
  }
  getForFollowUp(text:string,now=Date.now()):{image:LocalVisualImage;kind:VisualReference}|null{
    const kind=classifyVisualFollowUp(text)
    if(!kind || !this.entry || !this.entry.analyzed || this.expired(now))return null
    return {image:this.entry.image,kind}
  }
  hasAnalyzedFrame(now=Date.now()):boolean{
    return Boolean(this.entry && this.entry.analyzed && !this.expired(now))
  }
  hasFrame(now=Date.now()):boolean{
    return Boolean(this.entry && !this.expired(now))
  }
  expired(now=Date.now()):boolean{
    if(!this.entry)return false
    if(now-this.entry.acceptedAt<VISION_CONTEXT_TTL_MS)return false
    this.clear()
    return true
  }
  clear():void{
    this.entry=null
    this.generation++
  }
}
