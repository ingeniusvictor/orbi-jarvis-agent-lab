/**
 * VI-03.0 — temporal truth for a previously authorized, frozen visual frame.
 *
 * A VLM observing one still has no evidence of what happened before/after it.
 * Conservative Spanish detection: only clear temporal scene follow-ups.
 * This module NEVER opens a camera, accesses pixels or makes model calls.
 */
const normalize = (text: string): string => String(text ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ').trim()
  .replace(/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:lumi|lumia|jarvis)\s+/, '')

const nonVisual = /\b(?:hora|fecha|clima|temperatura|noticias|precio|bolsa|internet|google|github|calendario|musica|receta|codigo|programa|bateria|descargar|archivo|correo)\b/
const temporalScene = /\b(?:sigue|siguen|seguira|seguiran|todavia|aun|cambio|cambiaron|cambiado|cambia|movio|movieron|mueve|moviendo|ocurriendo|pasando|ahora|antes|despues)\b/
const sceneReferent = /\b(?:escena|imagen|foto|fotografia|camara|fotograma|objeto|persona|personas|figura|figuras|mano|manos|ventana|mesa|silla|puerta|caja|etiqueta|pantalla|esto|eso|alli|ahi|lugar|entorno|fondo|atras|delante|visor)\b/
const unambiguousScene = /^(?:(?:y|pero)\s+)?(?:que cambio|que ha cambiado|que esta pasando|que pasa ahora|que ves ahora|que ocurre ahora|sigue igual|sigue ahi|siguen ahi|se movio|se movieron|hay algun cambio|ha cambiado algo|que se movio|ahora que ves)\b/

/**
 * Returns true only when the user asks what is happening beyond an old still.
 * A visual follow-up can be answered from that still only when it is about
 * the still itself, not its presumed current state.
 */
export function requiresFreshVisualObservation(utterance: string): boolean {
  const q = normalize(utterance)
  if (!q || q.length > 350 || nonVisual.test(q)) return false
  if (unambiguousScene.test(q)) return true
  if (!temporalScene.test(q) || !sceneReferent.test(q)) return false
  // Avoid treating ordinary imperatives ("mira esto") as temporal follow-ups.
  return /^(?:y\s+)?(?:que|cual|como|donde|sigue|siguen|todavia|aun|ha|han|se|ves|hay|esta|estan|puedes decirme|dime si)\b/.test(q)
}

export type FrozenVisualSource = 'camera' | 'file'
export function frozenVisualTruthReply(source: FrozenVisualSource): string {
  if (source === 'file') {
    return 'La imagen cargada es una fotografía fija. Puedo describir lo que muestra, pero no sé qué ocurrió después ni si la escena sigue igual. Para comprobarlo, selecciona otra imagen reciente y pulsa Analizar imagen.'
  }
  return 'La última imagen es un fotograma congelado, no una cámara en directo. No puedo saber si la escena cambió o sigue igual. Para comprobarlo, pulsa Volver a encuadrar y después Capturar y analizar. No encenderé la cámara sin tu autorización.'
}
