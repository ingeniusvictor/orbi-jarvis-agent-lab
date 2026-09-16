import { probeLocalVoiceCapabilities } from './local-voice-probe.mjs'
import {
  getVoiceProfile,
  getVoiceRuntimeState,
  listVoiceProfiles,
  resolveVoiceRuntime,
  setVoiceProfileEnabled,
} from './voice-runtime.mjs'

/**
 * One canonical VRM status envelope shared by HTTP health, diagnostics and
 * WebSocket runtime-change frames.
 */
export function buildVoiceRuntimeStatus() {
  const local = probeLocalVoiceCapabilities()

  // The built-in Kokoro profile becomes selectable only when every required
  // local asset is present. This is a capability sync, not a user preference.
  setVoiceProfileEnabled('lumia-kokoro', local.tts.localAvailable)

  const requested = getVoiceRuntimeState()
  const effective = resolveVoiceRuntime({
    localSttAvailable: local.stt.localAvailable,
    browserSttAvailable: true,
    localTtsAvailable: local.tts.localAvailable,
    systemTtsAvailable: true,
  })
  const activeProfile = getVoiceProfile(requested.voiceProfile)

  return Object.freeze({
    status: 'READY',
    requested,
    effective,
    activeProfile,
    profiles: listVoiceProfiles().map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      provider: profile.provider,
      speakerRef: profile.speakerRef,
      enabled: profile.enabled,
      consentConfirmed: profile.consentConfirmed,
    })),
    local: {
      sttAvailable: local.stt.localAvailable,
      ttsAvailable: local.tts.localAvailable,
      whisper: {
        provider: local.stt.whisper.provider,
        commandReady: local.stt.whisper.commandReady,
        modelReady: local.stt.whisper.modelReady,
      },
      kokoro: {
        provider: local.tts.kokoro.provider,
        pythonReady: local.tts.kokoro.pythonReady,
        scriptReady: local.tts.kokoro.scriptReady,
        modelReady: local.tts.kokoro.modelReady,
        voicesReady: local.tts.kokoro.voicesReady,
      },
    },
  })
}
