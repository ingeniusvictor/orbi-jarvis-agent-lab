/**
 * VI-03.1 — a deliberately finite, user-enabled camera sampling session.
 * No persistent storage, automatic uploads, background inference or recorder.
 * The only active frame is the most recent in-memory JPEG, replaced in place.
 */
import type {LocalVisualImage,VisionResolution} from './visual-input'

export const ACTIVE_VISION_SAMPLE_MS=12_000
export const ACTIVE_VISION_MAX_SESSION_MS=180_000
export const ACTIVE_VISION_MAX_FRAME_AGE_MS=20_000

export type ActiveVisionFrame={
  image:LocalVisualImage
  resolution:VisionResolution
  capturedAt:number
}

const normalize=(value:string):string=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()
  .replace(/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:lumi|lumia|jarvis)\s+/,'')

/** An actual scene question, not general conversation about events/software. */
export function isActiveVisionQuestion(utterance:string):boolean{
  const q=normalize(utterance)
  if(!q || q.length>350)return false
  if(/\b(?:codigo|github|google|internet|clima|temperatura|noticias|calendario|precio|musica|receta|ollama|trabajo de hoy|hora actual)\b/.test(q))return false
  return /^(?:(?:por favor|puedes|podrias|me puedes|me podrias|dime|quiero que|necesito que)\s+)*(?:que ves|que estas viendo|que hay frente a (?:ti|la camara)|que hay en la camara|que aparece en la camara|que esta pasando (?:aqui|ahora|frente a ti)|que esta ocurriendo (?:aqui|ahora)|que cambio|que ha cambiado|sigue igual|sigue ahi|siguen ahi|se movio|se movieron|mira (?:esto|aqui|lo que tengo|lo que estoy mostrando)|observa (?:esto|aqui|lo que tengo)|describe (?:lo que ves|lo que estas viendo|la escena|esto|lo que aparece)|analiza (?:esto|lo que ves|lo que estoy mostrando)|lee (?:esto|esta etiqueta|este texto|lo que sostengo)|identifica (?:esto|este objeto|lo que tengo)|de que color es (?:esto|el objeto que tengo|lo que sostengo|la ropa|la camisa|la camiseta)|que color tiene (?:esto|la ropa|la camisa|la camiseta)|que hay (?:detras|delante|a la izquierda|a la derecha) de (?:mi|la camara|la persona|el objeto)|cuant[oa]s? (?:personas|objetos|niños|ninos|vasos|figuras) (?:hay|ves|aparecen)|que (?:ropa|camiseta|camisa|objeto|numero|texto) (?:ves|aparece|hay))\b/.test(q)
}

/** Do not hallucinate a temporal comparison from the sole retained JPEG. */
export function asksActiveVisionChange(utterance:string):boolean{
  const q=normalize(utterance)
  return /^(?:(?:y|pero)\s+)?(?:que (?:cambio|ha cambiado|se movio)|ha cambiado algo|sigue igual|sigue ahi|siguen ahi|se movio|se movieron|hay algun cambio|cambio de posicion|sigue (?:el|la|ese|esa|aquel|aquella)\b)/.test(q)
}

export function recentActiveVisionFrame(
  enabled:boolean,
  frame:ActiveVisionFrame|null,
  now=Date.now(),
):ActiveVisionFrame|null{
  if(!enabled || !frame || !Number.isFinite(now) || !Number.isFinite(frame.capturedAt))return null
  const age=now-frame.capturedAt
  if(age<0||age>ACTIVE_VISION_MAX_FRAME_AGE_MS)return null
  if(frame.image.mimeType!=='image/jpeg'||!frame.image.data)return null
  return frame
}
