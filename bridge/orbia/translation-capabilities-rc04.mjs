/**
 * LUMIA RC-04 — truthful voice description of translation features.
 *
 * Runtime facts are derived from the actual bridge opt-in switches. This is
 * an INFORMATION-ONLY reply to an already authorized conversational question:
 * it does not activate Translate, import audio or perform translation itself.
 * No new microphone, network or operating-system permissions.
 */
const fold = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ')
  .trim()

const translationWords =
  /\b(?:traductor|traduccion|traducciones|traducir|traduces|traduzco|traducirme|traducimos|traduciendo|interpretacion|interpretar)\b/
const descriptionWords =
  /\b(?:capacidades|capacidad|funciones|puedes|podrias|puedo|sabes|tienes|disponible|habilitado|admite|soporta|soportas|idiomas|audio|audios|archivos|texto|textos|voz|voces|como funciona|como usar|explicame|cuentame|comentame|dime|limitaciones|haces)\b/
const actionWords =
  /^(?:traduce|traduceme|traduzca|traduce esto|traduce lo siguiente|quiero que traduzcas|necesito que traduzcas|te voy a enviar|voy a adjuntar)\b/

const generalCapabilityQuestion =
  /\b(?:que capacidades tienes|cuales son tus capacidades|que funciones tienes|que puedes hacer actualmente|cuales son tus limitaciones|que habilidades tienes)\b/

export function translationRuntimeStatus(env = process.env) {
  const provider = String(env.ORBIA_BRAIN_PROVIDER ?? env.JARVIS_PROVIDER ?? '').trim().toLowerCase()
  const localProvider = provider === 'ollama'
  const textEnabled = localProvider && env.ORBIA_LUMIA_TRANSLATE_ENABLED === '1'
  const audioEnabled = textEnabled && env.ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED === '1'
  return Object.freeze({ localProvider, textEnabled, audioEnabled })
}

export function rc04TranslationCapabilityReply({ prompt, env = process.env } = {}) {
  const text = fold(prompt)
  if (!text) return null
  // Never take over a translation execution request. The actual translation
  // remains in its explicit UI endpoint with a selected language pair.
  if (actionWords.test(text)) return null

  const asksTranslationCapabilities =
    translationWords.test(text) && descriptionWords.test(text)
  const asksOverallCapabilities = generalCapabilityQuestion.test(text)
  if (!asksTranslationCapabilities && !asksOverallCapabilities) return null

  const { textEnabled, audioEnabled } = translationRuntimeStatus(env)
  if (asksOverallCapabilities) {
    if (!textEnabled) return null // Keep RC-03's conservative baseline.
    return 'Puedo conversar contigo con inteligencia artificial local, ayudarte a estudiar ' +
      'y traducir texto entre español, inglés y mandarín. ' +
      (audioEnabled
        ? 'También puedo transcribir y traducir notas de voz que adjuntes manualmente. '
        : 'La traducción de archivos de audio no está habilitada ahora. ') +
      'Dispongo de diagnósticos y controles específicos de modelos y voz, ' +
      'pero no tengo control general de tu computadora ni pronósticos meteorológicos en tiempo real.'
  }

  if (!textEnabled) {
    return 'El proyecto incluye un traductor local de textos y notas de voz, ' +
      'pero el modo de traducción no está habilitado en esta sesión. ' +
      'Necesito el perfil local con Ollama y las opciones correspondientes activadas.'
  }

  return 'Sí, puedo traducir textos entre español, inglés y mandarín. ' +
    (audioEnabled
      ? 'También puedo traducir archivos de voz guardados: activa el icono de idiomas, elige ' +
        'idioma de origen y destino y adjunta un audio de hasta noventa segundos y doce megabytes. ' +
        'Whisper local lo transcribe y Qwen local lo traduce; puedes corregir la transcripción ' +
        'y volver a traducir sin repetir el audio. '
      : 'La traducción de archivos de audio está desactivada en esta sesión. ' +
        'Para traducir texto, activa el icono de idiomas y selecciona origen y destino. ') +
    'Todavía no tengo interpretación simultánea continua, ' +
    'detección automática de idioma ni pronunciación multilingüe de las traducciones certificadas.'
}

export const RC04_TRANSLATION_FACTS =
  '\nCAPACIDADES DE TRADUCCIÓN DEL PILOTO: El modo Traducir local en la ' +
  'interfaz admite español, inglés y mandarín con idiomas de origen y destino ' +
  'elegidos manualmente. Cuando el perfil ASUS lo habilita, puede traducir ' +
  'textos y archivos de voz guardados: Whisper CLI los transcribe y Qwen ' +
  'local los traduce. Audio: máximo 90 segundos y 12 MB, sujeto a que el navegador ' +
  'pueda abrir su códec. El usuario puede corregir una transcripción y retraducir. ' +
  'NO hay interpretación simultánea continua, detección automática del idioma ' +
  'ni voz traducida multilingüe certificada. Nunca afirmes que no puedes ' +
  'procesar archivos de audio cuando el módulo LT-05 esté habilitado; ' +
  'tampoco finjas haber procesado un archivo que no fue adjuntado.'
