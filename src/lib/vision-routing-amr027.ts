/**
 * AMR-02.7 — reversible, question-only HD group routing.
 *
 * This classifier NEVER examines image pixels, activates the webcam or changes
 * a manually selected resolution. A generic photo description stays at 768px:
 * without computer vision, the app cannot know whether a file shows a crowd.
 */
import type {VisionResolution} from './visual-input'
import {chooseVisionResolution,type VisionResolutionChoice} from './vision-routing-amr024'

export type AdaptiveVisionRoute = ReturnType<typeof chooseVisionResolution> | {
  resolution:1024; reason:'group-count-hd'
}
const normalized=(q:string)=>String(q??'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()

/** Explicit people/groups/crowds; generic spatial questions remain 768px.
 * "Cuenta cinco monedas" does not trigger group-person 1024px.
 */
export function isPeopleGroupQuestion(question:string):boolean{
  const q=normalized(question)
  const people=/\b(?:persona|personas|gente|hombre|hombres|mujer|mujeres|nino|ninos|nina|ninas|figura humana|figuras humanas|individuos|multitud|grupo|grupal|equipo|reunion|familia|publico|concurrencia)\b/.test(q)
  const count=/\b(?:cuantos|cuantas|cuenta|contar|conteo|cantidad|numero|total|sumar|contabiliza|recuento|verifica|comprueba|personas visibles|de pie|agachados|sentados)\b/.test(q)
  const composition=/\b(?:grupo|grupal|multitud|muchas personas|varias personas|reunion de personas|equipo de personas|personas juntas|amontonad|superpuest|ocultas|ocultos)\b/.test(q)
  return people && (count || composition)
}

export function chooseAdaptiveVisionResolution(
  question:string,choice:VisionResolutionChoice,pilotEnabled:boolean
):AdaptiveVisionRoute{
  const previous=chooseVisionResolution(question,choice)
  if(!pilotEnabled || choice!=='auto' || previous.reason==='ocr')return previous
  if(isPeopleGroupQuestion(question))return {resolution:1024,reason:'group-count-hd'}
  return previous
}

export function shouldOfferGroupDetail(question:string,currentEdge:VisionResolution,enabled:boolean):boolean{
  return enabled && currentEdge<1024 && isPeopleGroupQuestion(question)
}
