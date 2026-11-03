/**
 * L.U.M.I.A. SKILL-01 — Single read-only source of capability truth.
 *
 * The catalog describes which integrations actually exist in code.
 * Availability is recomputed from the running bridge's switches and the local
 * Whisper/Kokoro asset probe when requested; never infer success of an operation
 * merely because its switch is enabled. Future modules register ONE new catalog
 * entry + evaluator here, rather than adding claims to conversational prompts.
 *
 * No persistence, remote calls, OS actions or microphone access.
 */
import { probeLocalVoiceCapabilities } from './local-voice-probe.mjs'
import { translationRuntimeStatus } from './translation-capabilities-rc04.mjs'

export const SKILL_REGISTRY_VERSION = 'SKILL-01'
export const SKILL_STATES = Object.freeze(['configured', 'experimental', 'disabled', 'unavailable', 'pending'])
const entry = (id, name, version, state, description, limitation, source) =>
  Object.freeze({ id, name, version, state, description, limitation, source })

/** Read-only current snapshot. Never treated as proof of end-to-end success. */
export function buildLumiaSkillRegistry({
  env = process.env,
  voiceProbe = probeLocalVoiceCapabilities,
} = {}) {
  const provider = String(env.ORBIA_BRAIN_PROVIDER ?? env.JARVIS_PROVIDER ?? '').toLowerCase().trim()
  const local = provider === 'ollama'
  const speech = voiceProbe({ env })
  const sttReady = Boolean(speech?.stt?.localAvailable)
  const ttsReady = Boolean(speech?.tts?.localAvailable)
  const translation = translationRuntimeStatus(env)
  const enabled = (value) => value === '1'
  const sttLocal = env.ORBIA_LUMIA_STT_MODE === 'local'
  const ttsLocal = env.ORBIA_LUMIA_TTS_MODE === 'local'
  const canVision = enabled(env.ORBIA_LUMIA_VISION_ENABLED)
  const capabilities = [
    entry('conversation', 'Conversación local', 'C1/VQ-01',
      local ? 'configured' : 'disabled',
      'Conversar, explicar conceptos y continuar intercambios con un modelo Ollama local.',
      'La disponibilidad y precisión del modelo no se comprueban en esta consulta.',
      'provider'),
    entry('session-context', 'Contexto de sesión', 'C1',
      local ? 'configured' : 'disabled',
      'Conservar un contexto breve durante la ejecución actual del bridge.',
      'No persiste al reiniciar: como máximo cuatro intercambios recientes por conversación.',
      'process-local'),
    entry('persistent-memory', 'Memoria persistente', 'MEM-01 (pendiente)',
      'pending',
      'Recordar información autorizada entre sesiones una vez implementada MEM-01.',
      'Todavía no se guardan recuerdos persistentes ni se recuperan sesiones anteriores.',
      'roadmap'),
    entry('stt-local', 'Reconocimiento de voz Whisper', 'C1-E',
      sttLocal ? (sttReady ? 'configured' : 'unavailable') : 'disabled',
      'Transcribir voz con Whisper.cpp local en el modo de entrada correspondiente.',
      sttReady ? 'Los archivos están presentes, pero la precisión no está garantizada.' :
        'Faltan componentes locales o no se seleccionó el modo Whisper.',
      'env+asset-probe'),
    entry('tts-local', 'Voz local Kokoro', 'VA-01',
      ttsLocal ? (ttsReady ? 'configured' : 'unavailable') : 'disabled',
      'Generar voz mediante Kokoro local.',
      ttsReady ? 'Archivos preparados; la reproducción real requiere una prueba de audio.' :
        'Faltan componentes locales o no se seleccionó el modo Kokoro.',
      'env+asset-probe'),
    entry('avatar-presence', 'Avatar virtual animado', 'PH-04/Motion R8',
      enabled(env.ORBIA_LUMIA_AVATAR_PH04) ? 'experimental' : 'disabled',
      'Tres vistas locales: solo rostro, medio cuerpo como principal y cuerpo completo. ' +
      'Puede cambiar de vista y solicitar gestos de un catálogo de 17 animaciones.',
      'La naturalidad corporal y la reproducción real de cada FBX requieren prueba en ASUS y archivos privados compatibles. ' +
      'No controla aplicaciones ni archivos del equipo.',
      'local-ui+motion-catalog'),
    entry('translation-text', 'Traducción de texto', 'LT-01/LT-04Q',
      translation.textEnabled ? 'configured' : 'disabled',
      'Traducir texto entre español, inglés y mandarín con idiomas seleccionados manualmente.',
      'La calidad depende de Qwen local; no hay detección automática de idioma.',
      'provider+env'),
    entry('translation-audio', 'Traducción de archivos de voz', 'LT-05/LT-05B',
      translation.audioEnabled ? (sttReady ? 'configured' : 'unavailable') : 'disabled',
      'Transcribir y traducir un archivo de audio adjuntado manualmente.',
      'Hasta 90 segundos y 12 MB; necesita Whisper multilingüe y códec compatible. No es interpretación simultánea.',
      'provider+env+asset-probe'),
    entry('vision-photo', 'Análisis de imágenes', 'VI-01',
      canVision && local ? 'experimental' : 'disabled',
      'Enviar una fotografía seleccionada expresamente al modelo local.',
      'Depende de disponer de un modelo multimodal compatible y no implica acceso permanente a cámara.',
      'provider+env'),
    entry('voice-model-controls', 'Controles locales específicos', 'C1-D',
      local ? 'configured' : 'disabled',
      'Consultar algunos diagnósticos y seleccionar modelos o ajustes de voz previstos.',
      'No habilita ejecución arbitraria de programas ni control general del escritorio.',
      'provider'),
    entry('live-weather', 'Pronóstico meteorológico en vivo', 'pendiente',
      'unavailable',
      'Consultar el pronóstico meteorológico actualizado cuando exista una fuente conectada.',
      'No hay una fuente meteorológica verificada conectada en este piloto.',
      'roadmap'),
    entry('desktop-control', 'Control general de computadora', 'pendiente',
      'unavailable',
      'Controlar otras aplicaciones mediante herramientas autorizadas en una fase futura.',
      'El control general del escritorio y las acciones arbitrarias no están habilitados.',
      'permissions'),
    entry('live-interpretation', 'Interpretación simultánea multilingüe', 'pendiente',
      'pending',
      'Interpretación en directo entre idiomas cuando exista una función validada.',
      'La traducción actual requiere modo explícito y selección manual de idiomas.',
      'roadmap'),
  ]
  return Object.freeze({
    schema: 1,
    version: SKILL_REGISTRY_VERSION,
    capabilities: Object.freeze(capabilities),
  })
}

const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()

/** Strictly informational inquiries. Don't intercept operational commands. */
export function isSkillRegistryInquiry(prompt) {
  const text = normalize(prompt)
  if (!text) return false
  if (/^(?:recuerda|recuerdame|guarda|memoriza|olvida|borra|elimina|traduce|traduceme|abre|ejecuta|instala|cambia|activa|desactiva)\b/.test(text)) return false
  // Leave focused translation questions to RC-04: its exact limits and UI
  // instructions are more useful than the generic inventory summary.
  if (/\b(?:traduccion|traducciones|traducir|traductor|traduces|traduciendo|interpretacion)\b/.test(text) &&
      /\b(?:audio|audios|texto|textos|idioma|idiomas)\b/.test(text)) return false
  return /\b(?:skills?|habilidades?|funciones?|capacidades?|memoria|recuerdos?|recordar|recuerdas|persistente)\b/.test(text) &&
    /\b(?:cuales?|que|como|tienes?|puedes?|esta|estan|activas?|disponibles?|habilitadas?|pendientes?|nuevas?|actualizadas?|lista|explica|cuentame|dime|comentame|sabes)\b/.test(text)
}

const isAskedMemory = (text) =>
  /\b(?:memoria|recuerdos?|recordar|recuerdas|persistente)\b/.test(text)
const isAskedSkillList = (text) =>
  /\b(?:habilidades?|skills?|funciones?|capacidades?)\b/.test(text)

/** Spanish spoken summary based solely on the registry snapshot. */
export function skillRegistryReply({ prompt, registry } = {}) {
  if (!isSkillRegistryInquiry(prompt) || !registry?.capabilities) return null
  const text = normalize(prompt)
  const skills = new Map(registry.capabilities.map(skill => [skill.id,skill]))
  const memory = skills.get('persistent-memory')
  const session = skills.get('session-context')
  if (isAskedMemory(text) && !isAskedSkillList(text)) {
    return 'Puedo mantener un contexto breve de la conversación mientras esta sesión está activa, ' +
      (session?.state === 'configured' ? 'pero ' : 'aunque ahora está deshabilitado; ') +
      (memory?.state === 'configured'
        ? 'la memoria entre sesiones aparece habilitada en el registro. Su funcionamiento debe validarse antes de confiar en un recuerdo.'
        : 'todavía no tengo memoria persistente entre reinicios. MEM-01 está pendiente y no voy a inventar recuerdos anteriores.')
  }

  const configured = registry.capabilities.filter(s =>
    s.state === 'configured' || s.state === 'experimental')
  const names = configured.map(s =>
    s.name + (s.state === 'experimental' ? ', experimental' : ''))
  const requestedLimits = /\b(?:limitaciones?|desactivad[oa]s?|no puedes|no tienes|pendientes?|faltan)\b/.test(text)
  if (requestedLimits) {
    const unavailable = registry.capabilities.filter(s =>
      s.state === 'pending' || s.state === 'unavailable')
    return 'Actualmente, estas funciones no están disponibles o siguen pendientes: ' +
      unavailable.map(s => s.name).join(', ') +
      '. También distingo las funciones deshabilitadas de las que todavía no están implementadas.'
  }

  if (!names.length) {
    return 'No tengo habilidades locales confirmadas como configuradas en esta sesión. ' +
      'Puedo mostrar el estado del registro, pero no voy a afirmar que funcionan sin verificar sus requisitos.'
  }
  const intro = /\b(?:nuevas?|actualizadas?|cambios?|versiones?)\b/.test(text)
    ? 'Puedo consultar mis habilidades actuales, pero aún no tengo un historial automático de cambios o versiones. '
    : 'Según mi configuración actual, tengo habilitadas estas funciones: '
  const shortNames = names.slice(0,7)
  return intro + shortNames.join(', ') +
    (names.length > shortNames.length ? ', entre otras' : '') +
    '. La habilitación no garantiza que cada operación funcione sin errores. ' +
    (memory?.state === 'pending' ? 'Mi memoria persistente sigue pendiente.' : '')
}
