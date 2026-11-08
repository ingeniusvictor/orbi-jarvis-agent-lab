/**
 * AMR-02.5 — Visual context safety, no image processing and no camera access.
 *
 * The caller may evaluate this ONLY for a still previously authorized by its
 * owner. A new photograph is never captured or enhanced by this module.
 */
import type {VisionResolution} from './visual-input'
import {chooseVisionResolution} from './vision-routing-amr024'

type FollowupDecision='proceed'|'clarify-reference'|'offer-high-resolution'
const normalize=(value:string)=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()
  .replace(/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:lumi|lumia|jarvis)\s+/,'')
  .trim()

/** "Esto" is ambiguous when reusing a scene JPEG. On an initial capture the
 * user may be pointing a single object at the camera, so do NOT intercept it. */
export function classifyExistingPhotoFollowup(question:string,resolution:VisionResolution):FollowupDecision{
  const q=normalize(question)
  if(chooseVisionResolution(question,'auto').reason==='ocr' && resolution<1024)
    return 'offer-high-resolution'
  // Narrow unqualified deictic phrases, no speculative object recognition.
  if(/^(?:(?:dime|puedes decirme|me dices|podrias decirme)\s+)?(?:de que color es esto|que color tiene esto|que es esto|que objeto es este|identifica esto|que ves en esto|de que color es esa cosa|de que color es este objeto)\s*$/.test(q))
    return 'clarify-reference'
  return 'proceed'
}

export type VisualUpgradeSource='file'|'camera'|'none'
export function visualDetailOfferMessage(source:VisualUpgradeSource):string{
  if(source==='file')return 'La foto guardada para esta conversación tiene resolución reducida. Para leer letras pequeñas con mayor detalle, pulsa Reanalizar archivo original a 1024 píxeles. No enviaré otra imagen sin que lo autorices.'
  if(source==='camera')return 'La imagen capturada tiene resolución reducida. Para leer esa etiqueta, pulsa Volver a encuadrar a 1024 píxeles y confirma Capturar y analizar. No encenderé la cámara automáticamente.'
  return 'Esta imagen puede ser demasiado pequeña para leer la etiqueta. Puedes cargar otra fotografía más nítida o autorizar una nueva captura a 1024 píxeles.'
}

export const visualReferenceClarification=()=>
  '¿A qué objeto o persona de la fotografía te refieres? Dime cuál, por ejemplo su posición o la prenda.'

/** An instruction, not a post-processor: never fabricate numerical confidence. */
export function calibratedVisionInstruction():string{
  return ' Distingue claramente contar figuras visibles de identificar personas: una cuenta no verifica identidad ni permite afirmar que todos están identificados. '+
    'Evita afirmaciones absolutas como "sin ambigüedades", "perfectamente reconocidos" o "todos claramente identificados" si no puedes comprobarlo. '+
    'Si un texto o logo es pequeño, ilegible o está borroso, di qué no puede leerse sin inventar letras o marcas. '+
    'Para referencias ambiguas, pide aclaración concreta; no adivines la prenda u objeto señalado.'
}
