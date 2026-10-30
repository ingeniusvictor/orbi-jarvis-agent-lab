/** RC-02: bounded response relevance guard for already authorized text.
 * No voice permissions, no additional network provider, no fabricated answers.
 */
const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function isSubstantiveQuestion(prompt) {
  const text = normalize(prompt)
  return /\b(?:que|como|cuando|donde|por que|cual|cuanto|explica|explicame|necesito|ayuda|aprender|hacer|informacion|capacidad|puedes|quiero|receta)\b/.test(text)
    && !/^(?:hola|holaaa|buenas|lumi|lumia|como estas|que tal|como estas lumi)[ !?.]*$/.test(text)
}

export function isGenericReplyForQuestion({ answer, prompt } = {}) {
  if (!isSubstantiveQuestion(prompt)) return false
  const text = normalize(answer)
  if (!text || text.length > 550) return false
  const stock = [
    'estoy aqui para ayudarte a organizar tus ideas',
    'que necesitas resolver hoy',
    'que desafio quieres abordar',
    'mi poder depende de lo que necesites',
    'soy lumia tu asistente inteligente de orbi',
  ]
  return stock.some((part) => text.includes(part))
}

export function safeClarificationForQuestion(prompt) {
  const text = normalize(prompt)
  if (/\barepa|arepas\b/.test(text) && /\bia local\b/.test(text))
    return 'Entendí que quieres información de IA local y una receta de arepas venezolanas. ¿Prefieres empezar por la receta o por IA local?'
  if (/\bcapacidad|capacidades\b/.test(text))
    return 'Puedo ayudarte a explicar conceptos, organizar ideas y responder consultas con los modelos locales instalados. Mi precisión depende de la pregunta y del modelo disponible. ¿Qué tarea concreta quieres probar?'
  return 'Entendí parte de tu solicitud, pero no pude preparar una respuesta confiable. ¿Puedes precisar la parte más importante?'
}
