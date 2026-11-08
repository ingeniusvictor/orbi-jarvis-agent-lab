/**
 * AMR-02.4 · Conservative, reversible selection of image resolution.
 *
 * Pure question classification only; it never opens the camera, invokes
 * Ollama or inspects/saves a photograph. Manual choice always wins.
 *
 * Measured with one ASUS photograph (direct Ollama benchmark):
 * 512px: 250 prompt tokens / 11.76s, model counted 7 people
 * 768px: 490 prompt tokens / 17.57s, model counted 8 people
 * 1024px: 826 prompt tokens / 28.14s, model counted 8 people
 * Therefore default descriptive/counting tasks to 768, not 512.
 */
import type {VisionResolution} from './visual-input'
import type {VisionReplyMode} from './vision-context-vi023'

export type VisionResolutionChoice='auto'|VisionResolution
export type VisionRouteReason='manual'|'ocr'|'count-or-spatial'|'simple-object'|'scene-default'
export type VisionRoute={resolution:VisionResolution;reason:VisionRouteReason}

const normalize=(value:string)=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()

// Prefer HD on any request where lost fine print could change the answer.
// Deliberately exclude vague "dime qué no puedes distinguir": standard scene
// descriptions should not be routed to 1024 just because they mention detail.
const ocr=/\b(?:ocr|leer|lee|leeme|leas|lectura|transcribe|transcribir|copiar texto|que dice|que pone|que esta escrito|escritura|escrito|letras|numeros escritos|etiqueta|letrero|cartel|placa|documento|factura|recibo|pantalla|captura de pantalla|codigo qr|codigo de barras|numero de serie|serial|matricula|medidor|medicion|valor exacto|valores exactos|logo|marca comercial|texto pequeno|texto diminuto|texto legible|letra pequena|caracteres|inscripcion)\b/
const counts=/\b(?:cuantos|cuantas|contar|cuenta|conteo|numero de personas|cantidad|total|personas|gente|grupo|grupal|hombres|mujeres|ninos|ninas|varias personas|posicion|posiciones|fondo|detras|atras|izquierda|derecha|encima|debajo|delante|agachados|sentados|de pie|distancia|detalles|varios objetos|muchos objetos)\b/
// The fast path is intentionally narrow: a single salient object or color.
// "Describe esta imagen", "qué ves" and ambiguous tasks stay at 768.
const simple=/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:(?:lumi|lumia|jarvis)\s+)?(?:(?:por favor|puedes|podrias|dime|me dices|quiero saber|identifica)\s+)*(?:de que color es (?:esto|este objeto|esta cosa)|que color tiene (?:esto|este objeto|esta cosa)|que objeto (?:es|ves)|identifica (?:este objeto|esta cosa)|que es (?:esto|este objeto|esta cosa)|reconoce (?:este objeto|esta cosa))\b/

export function chooseVisionResolution(question:string,choice:VisionResolutionChoice):VisionRoute{
  if(choice!== 'auto') {
    if(choice!==512 && choice!==768 && choice!==1024)throw new Error('Resolución visual no admitida.')
    return {resolution:choice,reason:'manual'}
  }
  const q=normalize(question)
  if(ocr.test(q))return {resolution:1024,reason:'ocr'}
  if(counts.test(q))return {resolution:768,reason:'count-or-spatial'}
  if(simple.test(q))return {resolution:512,reason:'simple-object'}
  return {resolution:768,reason:'scene-default'}
}

/** Additional voice brevity only in the opt-in pilot, with no hard truncation. */
export function visionSpeechBudget(mode:VisionReplyMode,enabled:boolean):string {
  if(!enabled || mode!=='breve')return ''
  return ' Para voz, responde de manera natural en una o dos frases completas, hasta 40 palabras y sin listas, encabezados o explicaciones genéricas. '+
    'Responde a lo que se preguntó; si se solicitó una limitación visual, menciona solo la más pertinente. '+
    'No inventes conteos ni omitas incertidumbre relevante. Termina la frase antes de concluir.'
}
