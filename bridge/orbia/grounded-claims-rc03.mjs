/**
 * L.U.M.I.A. RC-03 — truthful voice claims for the offline ASUS pilot.
 *
 * This module does not grant microphone, network, tool or OS access. It only
 * answers unsupported weather/capability claims for already-authorized turns.
 * Disabled outside explicitly opted-in pilot sessions.
 */
const fold = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim().replace(/\s+/g, ' ')

const weatherWords =
  /\b(?:clima|tiempo|pronostico|meteorologico|meteorologica|temperatura|lluvia|llover|llueve|nevadas?|nieva|nevar|prediccion)\b/
const weatherFuture =
  /\b(?:hoy|manana|pasado manana|actual|ahora|en vivo|tiempo real|este fin de semana|esta semana|proxima semana|pronostico|prediccion|va a llover|va a nevar|va a hacer)\b/
const explanatory =
  /^(?:que es|como funciona|como se forma|por que se forma|por que llueve|por que nieva|como se hace|como hacer|como calcular|explicame como hacer|explicame como calcular|explicame que es|cual es la diferencia)\b/
const weatherSourceChallenge =
  /\b(?:como hiciste|como calculaste|de donde sacaste|como sabes|de donde obtuviste|de donde salio|sin acceso|sin fuentes|sin consultar|inventaste)\b/
const generalCapabilities =
  /\b(?:que capacidades tienes|cuales son tus capacidades|que funciones tienes|que puedes hacer actualmente|cuales son tus limitaciones|que habilidades tienes)\b/
const computerTerms = /\b(?:computadora|ordenador|pc|escritorio|equipo|programas|aplicaciones|archivos)\b/
const computerActions = /\b(?:control|controlar|manejar|operar|ejecutar|abrir|instalar|modificar|borrar|eliminar|acceder)\b/
const capabilityQuestion = /\b(?:puedes|podrias|tienes|capacidad|habilitado|permiso|acceso|serias capaz)\b/

function recentWeatherContext(history) {
  if (!Array.isArray(history)) return false
  return history.slice(-6).some((entry) =>
    entry?.role === 'assistant' &&
    weatherWords.test(fold(entry.content)),
  )
}

function priorUnverifiedForecast(history) {
  if (!Array.isArray(history)) return false
  const last = [...history].reverse().find((entry) => entry?.role === 'assistant')
  const answer = fold(last?.content)
  // A truthful disclaimer is not an invented prediction.
  if (/\b(?:no tengo|no puedo confirmar|no he consultado|sin datos|sin fuentes|sin verificar)\b/.test(answer)) return false
  return /\b(?:probablemente|posibles|nevadas?|llovera|nevara|temperaturas? entre|se esperan|estara soleado|estara nublado|habra lluvia|habra nieve)\b/.test(answer)
}

function noForecastReply() {
  return 'No he consultado datos meteorológicos ni he ejecutado un modelo del ' +
    'tiempo. Si antes mencioné condiciones concretas sin una fuente, no eran ' +
    'una predicción verificada; para confirmarlas necesito datos actualizados.'
}

function weatherReply() {
  return 'En este piloto no tengo una fuente meteorológica actualizada conectada, ' +
    'ni he consultado datos del tiempo para esta pregunta. No puedo confirmar un ' +
    'pronóstico fiable sin verificarlos. Puedes consultar el pronóstico oficial ' +
    'y, si me compartes sus datos, te ayudo a interpretarlos.'
}

function correctionReply() {
  return 'Tienes razón: mi pronóstico anterior no estaba respaldado por datos ' +
    'meteorológicos consultados. Fue una suposición del modelo de lenguaje, ' +
    'no una predicción verificada; no debí presentarla como tal.'
}

function computerReply() {
  return 'En este piloto no tengo habilitado el control general de tu computadora ' +
    'ni puedo ejecutar acciones arbitrarias. Sí dispongo de algunas funciones ' +
    'locales específicas, como consultar diagnósticos y gestionar modelos o ' +
    'ajustes de voz mediante comandos previstos. Un futuro control del equipo ' +
    'requeriría herramientas autorizadas y confirmación explícita.'
}

function capabilityReply() {
  return 'Puedo conversar contigo, explicar conceptos, ayudarte a estudiar y ' +
    'organizar información usando la inteligencia artificial local. También ' +
    'dispongo de algunas consultas de diagnóstico y controles específicos de ' +
    'modelos y voz. No tengo una fuente de clima actualizada ni control general ' +
    'de tu computadora habilitados en este piloto.'
}

/** Null means leave the question to Qwen's normal conversational pipeline. */
export function rc03GroundedReply({ prompt, history = [] } = {}) {
  const text = fold(prompt)
  if (!text) return null

  const hadWeatherContext = recentWeatherContext(history)
  const directWeather = weatherWords.test(text)
  // A location/date given in direct reply to a prior meteorological question
  // should NOT silently become an invented forecast.
  const locationFollowup = hadWeatherContext &&
    /\b(?:estoy|vivo|me encuentro|mi ciudad|estamos)\b/.test(text) &&
    /\b(?:en|ciudad)\b/.test(text) &&
    /\b(?:hoy|manana|noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|fecha|dia)\b/.test(text)

  if (directWeather && hadWeatherContext && weatherSourceChallenge.test(text)) {
    return priorUnverifiedForecast(history) ? correctionReply() : noForecastReply()
  }

  if (locationFollowup) return weatherReply()

  const weatherQuery = directWeather && (
    weatherFuture.test(text) ||
    /\b(?:tienes informacion|tienes datos|sabes el clima|como estara|como va a estar|que tiempo hace|como esta el clima)\b/.test(text)
  )

  // Educational questions are not requests for observed meteorology.
  if (weatherQuery && !explanatory.test(text)) return weatherReply()

  if (computerTerms.test(text) && computerActions.test(text) &&
      capabilityQuestion.test(text) && !/^(?:como puedo|como se|explicame como)\b/.test(text)) {
    return computerReply()
  }

  if (generalCapabilities.test(text)) return capabilityReply()

  return null
}

export const RC03_VOICE_GROUNDING_INSTRUCTION =
  '\nEn este piloto local NO hay herramienta meteorológica actualizada ni ' +
  'control general del escritorio habilitados. No inventes pronósticos, ' +
  'temperaturas, nevadas, observaciones en tiempo real, fuentes consultadas ' +
  'ni ejecuciones de modelos meteorológicos. Si antes afirmaste un pronóstico ' +
  'sin datos, reconoce expresamente la equivocación. Distingue las capacidades ' +
  'concretas disponibles de posibles integraciones futuras. Puedes explicar ' +
  'conceptos generales de meteorología sin fingir acceso a mediciones.'
