/**
 * O.R.B.I.A. Voice Runtime Manager — VRM-01A.
 *
 * Provider-neutral runtime preferences for how L.U.M.I.A. hears and speaks.
 * Browser/system and local Whisper/Kokoro paths now converge through this
 * canonical runtime state while preserving deterministic fallback behaviour.
 */

export const STT_MODES = Object.freeze(['auto', 'browser', 'local'])
export const TTS_MODES = Object.freeze(['auto', 'system', 'local'])

const normalizeChoice = (value) => String(value ?? '').trim().toLowerCase()

const requireChoice = (value, allowed, label) => {
  const next = normalizeChoice(value)
  if (!allowed.includes(next)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`)
  }
  return next
}

export function createVoiceProfile({
  id,
  displayName,
  provider,
  language = 'es',
  locale = 'es-CL',
  modelRef,
  speakerRef,
  owner = 'ORBI',
  consentConfirmed = true,
  deviceScope = 'local',
  enabled = true,
}) {
  const profileId = String(id ?? '').trim()
  const name = String(displayName ?? '').trim()
  const providerId = String(provider ?? '').trim()

  if (!/^[a-z0-9_-]{1,80}$/.test(profileId)) {
    throw new Error('Voice profile id must be lowercase letters, numbers, dashes or underscores.')
  }
  if (!name || !providerId) {
    throw new Error('Voice profile requires displayName and provider.')
  }

  return Object.freeze({
    id: profileId,
    displayName: name,
    provider: providerId,
    language: String(language ?? 'es'),
    locale: String(locale ?? 'es-CL'),
    modelRef: modelRef ? String(modelRef) : undefined,
    speakerRef: speakerRef ? String(speakerRef) : undefined,
    owner: String(owner ?? 'ORBI'),
    consentConfirmed: Boolean(consentConfirmed),
    deviceScope: String(deviceScope ?? 'local'),
    enabled: Boolean(enabled),
  })
}

const profiles = new Map()

function installBuiltIns() {
  const builtIns = [
    createVoiceProfile({
      id: 'lumia-system',
      displayName: 'L.U.M.I.A. · voz del sistema',
      provider: 'system',
      language: 'es',
      locale: 'es-CL',
      owner: 'ORBI',
      consentConfirmed: true,
    }),
    createVoiceProfile({
      id: 'lumia-kokoro',
      displayName: 'L.U.M.I.A. · Kokoro local',
      provider: 'kokoro-local',
      language: 'es',
      locale: 'es-CL',
      modelRef: 'kokoro-v1.0.onnx',
      speakerRef: 'ef_dora',
      owner: 'ORBI',
      consentConfirmed: true,
      enabled: false,
    }),
  ]
  for (const profile of builtIns) profiles.set(profile.id, profile)
}

installBuiltIns()

export function registerVoiceProfile(profile) {
  const normalized = createVoiceProfile(profile)
  if (profiles.has(normalized.id)) {
    throw new Error(`Voice profile "${normalized.id}" is already registered.`)
  }
  profiles.set(normalized.id, normalized)
  return normalized
}

export function upsertVoiceProfile(profile) {
  const normalized = createVoiceProfile(profile)
  profiles.set(normalized.id, normalized)
  return normalized
}

export function listVoiceProfiles({ enabledOnly = false } = {}) {
  return Object.freeze(
    [...profiles.values()].filter((profile) => !enabledOnly || profile.enabled),
  )
}

export function getVoiceProfile(id) {
  return profiles.get(String(id ?? '').trim()) ?? null
}

export function setVoiceProfileEnabled(id, enabled) {
  const current = getVoiceProfile(id)
  if (!current) throw new Error(`Unknown voice profile "${id}".`)
  return upsertVoiceProfile({
    ...current,
    enabled: Boolean(enabled),
  })
}

const normalizeIntent = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function resolveVoiceProfileRequest(requested) {
  const q = normalizeIntent(requested)
  if (!q) return null

  const exact = [...profiles.values()].find(
    (profile) =>
      normalizeIntent(profile.id) === q ||
      normalizeIntent(profile.displayName) === q,
  )
  if (exact) return exact

  if (
    q.includes('sistema') ||
    q.includes('system') ||
    q.includes('normal') ||
    q.includes('predeterminada') ||
    q.includes('default')
  ) {
    return getVoiceProfile('lumia-system')
  }

  const fuzzy = [...profiles.values()].find((profile) => {
    const id = normalizeIntent(profile.id)
    const name = normalizeIntent(profile.displayName)
    return id.includes(q) || name.includes(q)
  })
  if (fuzzy) return fuzzy

  if (q.includes('kokoro') || q.includes('local')) {
    return getVoiceProfile('lumia-kokoro')
  }

  return null
}

/**
 * Parse explicit spoken voice controls before they reach the LLM. Keeping these
 * deterministic prevents a small local model from inventing capabilities or
 * claiming a switch happened when the runtime did not actually change.
 */
export function parseVoiceRuntimeControl(prompt) {
  const text = normalizeIntent(prompt)
  if (!text) return null

  if (
    text.includes('que voces tienes') ||
    text.includes('que voces puedo usar') ||
    text.includes('voces disponibles') ||
    text.includes('lista las voces') ||
    text.includes('listar voces')
  ) {
    return { action: 'list_profiles' }
  }

  if (
    text.includes('modo de voz automatico') ||
    text.includes('voz en automatico') ||
    text.includes('voz automatica')
  ) {
    return { action: 'set_auto' }
  }
  if (
    text.includes('modo de voz local') ||
    text.includes('modo local de voz') ||
    text.includes('activa modo local') ||
    text.includes('usa modo local')
  ) {
    return { action: 'set_mode', mode: 'local' }
  }

  if (
    text.includes('modo de voz navegador') ||
    text.includes('modo navegador de voz') ||
    text.includes('activa modo navegador') ||
    text.includes('usa modo navegador')
  ) {
    return { action: 'set_mode', mode: 'browser' }
  }


  if (
    text.includes('reconocimiento local') ||
    text.includes('whisper local') ||
    text.includes('escuchame local') ||
    text.includes('escucha local')
  ) {
    return { action: 'set_stt', mode: 'local' }
  }

  if (
    text.includes('reconocimiento del navegador') ||
    text.includes('reconocimiento navegador') ||
    text.includes('speech recognition') ||
    text.includes('escucha del navegador') ||
    text.includes('escucha navegador')
  ) {
    return { action: 'set_stt', mode: 'browser' }
  }

  if (
    text.includes('usa voz local') ||
    text.includes('usa la voz local') ||
    text.includes('voz kokoro') ||
    text.includes('usa kokoro')
  ) {
    return { action: 'set_tts', mode: 'local' }
  }

  if (
    text.includes('voz del sistema') ||
    text.includes('usa la voz del sistema') ||
    text.includes('voz de windows') ||
    text.includes('voz del navegador')
  ) {
    return { action: 'set_tts', mode: 'system' }
  }

  if (
    text.includes('estado de la voz') ||
    text.includes('que modo de voz') ||
    text.includes('cual es el modo de voz') ||
    text.includes('que reconocimiento de voz') ||
    text.includes('que voz estas usando')
  ) {
    return { action: 'status' }
  }

  const profileMatch = text.match(
    /(?:usa|utiliza|activa|cambia a|pon) (?:la )?voz (.+)$/,
  )
  if (profileMatch?.[1]) {
    return { action: 'set_profile', requested: profileMatch[1].trim() }
  }

  return null
}

const initialProfile =
  process.env.ORBIA_VOICE_PROFILE?.trim() || 'lumia-system'

let runtimeState = {
  sttMode: requireChoice(
    process.env.ORBIA_STT_MODE ?? 'auto',
    STT_MODES,
    'STT mode',
  ),
  ttsMode: requireChoice(
    process.env.ORBIA_TTS_MODE ?? 'auto',
    TTS_MODES,
    'TTS mode',
  ),
  voiceProfile: profiles.has(initialProfile) ? initialProfile : 'lumia-system',
}

export function getVoiceRuntimeState() {
  return Object.freeze({ ...runtimeState })
}

export function setSttMode(mode) {
  runtimeState = {
    ...runtimeState,
    sttMode: requireChoice(mode, STT_MODES, 'STT mode'),
  }
  return getVoiceRuntimeState()
}

export function setTtsMode(mode) {
  runtimeState = {
    ...runtimeState,
    ttsMode: requireChoice(mode, TTS_MODES, 'TTS mode'),
  }
  return getVoiceRuntimeState()
}

export function setVoiceProfile(id) {
  const profile = getVoiceProfile(id)
  if (!profile) throw new Error(`Unknown voice profile "${id}".`)
  if (!profile.enabled) throw new Error(`Voice profile "${id}" is not available.`)
  if (!profile.consentConfirmed) {
    throw new Error(`Voice profile "${id}" has no confirmed owner consent.`)
  }
  runtimeState = { ...runtimeState, voiceProfile: profile.id }
  return getVoiceRuntimeState()
}

export function resolveVoiceRuntime({
  localSttAvailable = false,
  browserSttAvailable = true,
  localTtsAvailable = false,
  systemTtsAvailable = true,
} = {}) {
  const state = getVoiceRuntimeState()

  const effectiveStt =
    state.sttMode === 'local'
      ? localSttAvailable ? 'local' : browserSttAvailable ? 'browser' : 'unavailable'
      : state.sttMode === 'browser'
        ? browserSttAvailable ? 'browser' : localSttAvailable ? 'local' : 'unavailable'
        : browserSttAvailable
          ? 'browser'
          : localSttAvailable
            ? 'local'
            : 'unavailable'

  const effectiveTts =
    state.ttsMode === 'local'
      ? localTtsAvailable ? 'local' : systemTtsAvailable ? 'system' : 'unavailable'
      : state.ttsMode === 'system'
        ? systemTtsAvailable ? 'system' : localTtsAvailable ? 'local' : 'unavailable'
        : systemTtsAvailable
          ? 'system'
          : localTtsAvailable
            ? 'local'
            : 'unavailable'

  return Object.freeze({
    ...state,
    effectiveStt,
    effectiveTts,
  })
}
