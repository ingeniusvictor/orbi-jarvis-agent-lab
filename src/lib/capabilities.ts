import { BACKEND, BRIDGE_HTTP_URL, env } from '../config'

/**
 * Speech capability/readiness snapshot.
 *
 * The bridge reports the provider-neutral VRM state plus local Whisper/Kokoro
 * readiness. Legacy ElevenLabs booleans remain for compatibility. The snapshot
 * can also be updated live after a spoken voice-mode command, allowing the
 * Companion to switch engines without a page reload.
 *
 * Direct mode remains browser-only because local bridge runtimes and bridge-held
 * credentials are intentionally unavailable there.
 */

export type VoiceRuntimeCapabilities = {
  status?: string
  requested?: {
    sttMode?: string
    ttsMode?: string
    voiceProfile?: string
  }
  effective?: {
    effectiveStt?: string
    effectiveTts?: string
  }
  local?: {
    sttAvailable?: boolean
    ttsAvailable?: boolean
    whisper?: {
      provider?: string
      commandReady?: boolean
      modelReady?: boolean
    }
    kokoro?: {
      provider?: string
      pythonReady?: boolean
      scriptReady?: boolean
      modelReady?: boolean
      voicesReady?: boolean
    }
  }
  activeProfile?: {
    id?: string
    displayName?: string
    provider?: string
    speakerRef?: string
    enabled?: boolean
    consentConfirmed?: boolean
  } | null
  profiles?: Array<{
    id?: string
    displayName?: string
    provider?: string
    speakerRef?: string
    enabled?: boolean
    consentConfirmed?: boolean
  }>
  elevenlabs?: {
    available?: boolean
  }
}

export type Capabilities = {
  /** ElevenLabs speech-to-text (Scribe) is reachable via the bridge. */
  stt: boolean
  /** ElevenLabs text-to-speech is reachable via the bridge. */
  tts: boolean
  /** Provider-neutral VRM/C1-E readiness. Optional for older bridge builds. */
  voice?: VoiceRuntimeCapabilities
}

/** Browser-only until the probe says otherwise. Safe default: the app works. */
let current: Capabilities = { stt: false, tts: false }
let probed = false

/** The last known capabilities. Read synchronously by the voice and speech
 *  layers; accurate once `probeCapabilities` has resolved during boot. */
export function caps(): Capabilities {
  return current
}

export function capabilitiesProbed(): boolean {
  return probed
}

/** Apply a live VRM update pushed by the bridge after a spoken voice command. */
export function applyVoiceRuntimeSnapshot(
  voice: VoiceRuntimeCapabilities | undefined,
): Capabilities {
  if (!voice) return current
  current = {
    ...current,
    voice: {
      ...(current.voice ?? {}),
      ...voice,
      local: {
        ...(current.voice?.local ?? {}),
        ...(voice.local ?? {}),
      },
      elevenlabs: {
        ...(current.voice?.elevenlabs ?? {}),
        ...(voice.elevenlabs ?? {}),
      },
    },
  }
  return current
}

/**
 * Ask the bridge what it can do, once. Called during the boot sequence, before
 * the voice loop starts, so the first "Hey Jarvis" already uses the right
 * engine. Never throws: a failed probe simply leaves the browser fallback in
 * place, which is the correct behaviour when the bridge is unreachable.
 */
export async function probeCapabilities(): Promise<Capabilities> {
  if (BACKEND !== 'bridge') {
    // No bridge to ask. Direct mode has no server-side speech, so browser only.
    current = { stt: false, tts: false }
    probed = true
    return current
  }
  try {
    const res = await fetch(`${BRIDGE_HTTP_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const h = (await res.json()) as {
        stt?: boolean
        tts?: boolean
        voice?: VoiceRuntimeCapabilities
      }
      current = {
        stt: Boolean(h.stt),
        tts: Boolean(h.tts),
        voice: h.voice,
      }
    }
  } catch {
    // Bridge down or slow — stay on the browser engines rather than blocking
    // boot on a health check that is only an optimisation.
  }
  probed = true
  return current
}

/** A short human label for the HUD: what voice stack is actually in play. */
export function engineLabel(): string {
  const c = current
  if (c.stt && c.tts) return 'ElevenLabs'
  if (c.tts) return 'ElevenLabs voice'
  // env.elevenKey is only meaningful in direct mode; harmless to mention.
  if (env.elevenKey && BACKEND !== 'bridge') return 'ElevenLabs (direct)'
  return 'browser speech'
}
