/**
 * O.R.B.I.A. Voice Runtime Manager — VRM-01A.
 *
 * Provider-neutral runtime preferences for how L.U.M.I.A. hears and speaks.
 * The current browser voice path remains untouched until C1-E integration is
 * certified; this module is the canonical source of truth for future routing.
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
        : localSttAvailable
          ? 'local'
          : browserSttAvailable
            ? 'browser'
            : 'unavailable'

  const effectiveTts =
    state.ttsMode === 'local'
      ? localTtsAvailable ? 'local' : systemTtsAvailable ? 'system' : 'unavailable'
      : state.ttsMode === 'system'
        ? systemTtsAvailable ? 'system' : localTtsAvailable ? 'local' : 'unavailable'
        : localTtsAvailable
          ? 'local'
          : systemTtsAvailable
            ? 'system'
            : 'unavailable'

  return Object.freeze({
    ...state,
    effectiveStt,
    effectiveTts,
  })
}
