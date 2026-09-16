/**
 * Provider-neutral execution of deterministic Voice Runtime Manager controls.
 *
 * Parsing and state live in voice-runtime.mjs; readiness lives in
 * voice-status.mjs. Keeping execution here prevents Ollama (or any future LLM)
 * from becoming the owner of speech-engine state.
 */

import { buildVoiceRuntimeStatus } from './voice-status.mjs'
import {
  resolveVoiceProfileRequest,
  setSttMode,
  setTtsMode,
  setVoiceProfile,
} from './voice-runtime.mjs'

function voiceStatusToSpeech(status) {
  const profile =
    status?.activeProfile?.displayName ??
    status?.requested?.voiceProfile ??
    'voz predeterminada'
  return (
    `Reconocimiento ${status?.effective?.effectiveStt ?? 'desconocido'}. ` +
    `Salida de voz ${status?.effective?.effectiveTts ?? 'desconocida'}. ` +
    `Perfil ${profile}.`
  )
}

export function applyVoiceRuntimeControl(control) {
  const before = buildVoiceRuntimeStatus()

  if (!control || typeof control !== 'object') {
    return {
      changed: false,
      answer: 'No entendí el cambio de voz solicitado.',
      status: before,
    }
  }

  if (control.action === 'status') {
    return {
      changed: false,
      answer: voiceStatusToSpeech(before),
      status: before,
    }
  }

  if (control.action === 'list_profiles') {
    const profiles = before.profiles
      .map((profile) =>
        profile.enabled
          ? profile.displayName
          : `${profile.displayName}, no disponible`,
      )
      .join(', ')

    return {
      changed: false,
      answer: profiles
        ? `Tengo estos perfiles de voz: ${profiles}.`
        : 'No encuentro perfiles de voz disponibles.',
      status: before,
    }
  }

  if (control.action === 'set_auto') {
    setSttMode('auto')
    setTtsMode('auto')
    const status = buildVoiceRuntimeStatus()
    return {
      changed: true,
      answer: `Modo de voz automático activado. ${voiceStatusToSpeech(status)}`,
      status,
    }
  }

  if (control.action === 'set_mode') {
    if (control.mode === 'local') {
      setSttMode('local')
      setTtsMode('local')
      const status = buildVoiceRuntimeStatus()

      if (status.local.ttsAvailable) setVoiceProfile('lumia-kokoro')

      return {
        changed: true,
        answer:
          'Modo local activado. ' +
          (status.local.sttAvailable
            ? 'Usaré Whisper para escucharte. '
            : 'Whisper aún no está disponible y usaré el navegador como respaldo. ') +
          (status.local.ttsAvailable
            ? 'Usaré la voz local de L.U.M.I.A.'
            : 'Kokoro aún no está disponible y usaré la voz del sistema como respaldo.'),
        status: buildVoiceRuntimeStatus(),
      }
    }

    if (control.mode === 'browser') {
      setSttMode('browser')
      setTtsMode('system')
      setVoiceProfile('lumia-system')
      const status = buildVoiceRuntimeStatus()
      return {
        changed: true,
        answer:
          'Modo navegador activado. Usaré reconocimiento del navegador y voz del sistema.',
        status,
      }
    }
  }

  if (control.action === 'set_stt') {
    if (control.mode === 'local' && !before.local.sttAvailable) {
      return {
        changed: false,
        answer:
          'Whisper local todavía no está preparado. Mantengo el reconocimiento actual.',
        status: before,
      }
    }

    setSttMode(control.mode)
    const status = buildVoiceRuntimeStatus()
    return {
      changed: true,
      answer:
        control.mode === 'local'
          ? 'Listo. Ahora usaré reconocimiento local con Whisper.'
          : 'Listo. Ahora usaré el reconocimiento del navegador.',
      status,
    }
  }

  if (control.action === 'set_tts') {
    if (control.mode === 'local' && !before.local.ttsAvailable) {
      return {
        changed: false,
        answer:
          'Kokoro local todavía no está preparado. Mantengo la voz actual.',
        status: before,
      }
    }

    setTtsMode(control.mode)
    if (control.mode === 'local') setVoiceProfile('lumia-kokoro')
    if (control.mode === 'system') setVoiceProfile('lumia-system')

    const status = buildVoiceRuntimeStatus()
    return {
      changed: true,
      answer:
        control.mode === 'local'
          ? 'Listo. Ahora usaré la voz local de L.U.M.I.A.'
          : 'Listo. Ahora usaré la voz del sistema.',
      status,
    }
  }

  if (control.action === 'set_profile') {
    const profile = resolveVoiceProfileRequest(control.requested)

    if (!profile) {
      return {
        changed: false,
        answer:
          'No encuentro un perfil de voz que coincida con esa solicitud.',
        status: before,
      }
    }
    if (!profile.enabled) {
      return {
        changed: false,
        answer: `${profile.displayName} todavía no está disponible en este equipo.`,
        status: before,
      }
    }

    setVoiceProfile(profile.id)
    if (profile.provider === 'system') setTtsMode('system')
    if (profile.provider.includes('local')) setTtsMode('local')

    const status = buildVoiceRuntimeStatus()
    return {
      changed: true,
      answer: `Listo. Perfil de voz cambiado a ${profile.displayName}.`,
      status,
    }
  }

  return {
    changed: false,
    answer: 'No entendí el cambio de voz solicitado.',
    status: before,
  }
}
