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
    ? ' Responde en español de forma breve, idealmente en una o dos frases y hasta 40 palabras. Prioriza la pregunta concreta; evita introducciones, repetir la descripción inicial o enumerar detalles no solicitados. No inventes detalles.'
    : ' Responde en español con detalles útiles pero sin repetir información innecesaria. Explica qué no puedes distinguir.'

/** VISION-02.3.1: a small, local instruction about spatial references.
 * It is NOT a camera action or an object detector; Qwen must still inspect
 * the actual attached JPEG rather than accept a guessed spatial inventory.
 */
export function visualSpatialFocus(question:string):string{
  const q=clean(question)
  const spatial=/\b(?:detras|destras|atras|tras|fondo|segundo plano|a la izquierda|a la derecha|al lado|encima|debajo|frente a|delante)\b/.test(q)
  if(!spatial)return ''
  const asksColor=/\b(?:color|colores|tonalidad)\b/.test(q)
  return ' La pregunta contiene una referencia espacial. IDENTIFICA PRIMERO el objeto, persona o zona que está en la posición preguntada en el fotograma; '+
    'no respondas hablando únicamente de la ropa u objetos de primer plano si preguntan qué hay detrás. '+
    (asksColor
      ? 'Después describe el color del elemento situado en esa posición, SOLO si puedes identificarlo; si no está claro a cuál elemento se refiere el color, pide una aclaración breve. '
      : '')+
    'Comprueba el fondo de la imagen actual; no afirmes que no hay más objetos si se ven otros elementos.'
}

export const followupVisionPrompt=(question:string,mode:VisionReplyMode):string=>
  'Pregunta de seguimiento del usuario sobre LA MISMA fotografía adjunta nuevamente en este turno. '+
  'Observa la imagen ACTUAL de nuevo, no tomes la descripción anterior como sustituto de la fotografía. '+
  'Responde exactamente a lo preguntado, sin suponer que la cámara sigue activa. '+
  'Pregunta: '+question.trim()+'.'+visualSpatialFocus(question)+visualModeInstruction(mode)

function clean(value:string):string{
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim()
}
const unrelated=/\b(?:hora|fecha|clima|temperatura|noticias|precio|internet|google|github|ollama|receta|codigo|programar|javascript|musica|youtube|juego|bateria|calendario|crear|generar|editar|modificar|exportar|guardar|compartir|enviar|subir|video|grabar)\b/
const explicit=/\b(?:foto|fotografia|imagen|captura|fotograma|esa escena|esta escena|la escena|lo que viste|lo que observaste|lo que acabas de ver|la misma imagen|la misma foto|la foto anterior|esa foto)\b/
const sceneWords=/\b(?:objeto|detras|destras|atras|fondo|adelante|arriba|abajo|izquierda|derecha|al lado|persona|personas|hombre|mujer|nino|nina|ninos|ropa|camiseta|vestimenta|colores|color|cabello|manos|mano|cara|rostro|ventana|pared|cortina|mesa|silla|habitacion|figura|letrero|etiqueta|texto|aparece|aparecen|sostiene|llevan|lleva|viste|hay|ahi|eso|ese|esa|aquello)\b/
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
  if(explicit.test(said) && (questionForm.test(said) ||
    /^(?:quiero saber|dime|describe|analiza|observa|revisa|explica|lee|recuerdas)\b/.test(said)))return 'explicit'
  if(/^(?:y )?(?:que mas|algo mas|que otros detalles|dime mas|hay algo mas|puedes decirme mas)\b/.test(said)) return 'contextual'
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
  /** The viewer's own question form is explicit authorization to reuse it. */
  getAuthorizedFrame(now=Date.now()):{image:LocalVisualImage;kind:VisualReference}|null{
    if(!this.entry || !this.entry.analyzed || this.expired(now))return null
    return {image:this.entry.image,kind:'explicit'}
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
