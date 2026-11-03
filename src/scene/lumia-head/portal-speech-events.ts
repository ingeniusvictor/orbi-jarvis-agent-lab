/**
 * PH-01: Minimal, DOM-local bridge from the EXISTING Portal TTS to the new
 * head renderer. This does not start a second speech, STT, or LLM engine.
 * Events are emitted only when playback actually starts or stops.
 */
export const LUMIA_PORTAL_SPEECH_EVENT = 'lumia:portal-speech' as const

export type PortalSpeechEvent =
  | { kind: 'start'; turnId: string }
  | { kind: 'phrase'; turnId: string; text: string }
  | { kind: 'end'; turnId: string; reason: 'complete' | 'interrupted' }

let activeTurn: string | null = null

function emit(detail: PortalSpeechEvent): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<PortalSpeechEvent>(LUMIA_PORTAL_SPEECH_EVENT, { detail }))
}

/** Call only from onFirstAudioStart (real audible onset). */
export function portalSpeechStart(turnId: string): void {
  if (activeTurn && activeTurn !== turnId) {
    emit({ kind: 'end', turnId: activeTurn, reason: 'interrupted' })
  }
  activeTurn = turnId
  emit({ kind: 'start', turnId })
}

/** Called from onPhraseStart; text is what is *actually* being played. */
export function portalSpeechPhrase(turnId: string, text: string): void {
  if (activeTurn !== turnId) return
  emit({ kind: 'phrase', turnId, text })
}

export function portalSpeechEnd(turnId: string, reason: 'complete' | 'interrupted' = 'complete'): void {
  if (activeTurn !== turnId) return
  activeTurn = null
  emit({ kind: 'end', turnId, reason })
}

export function portalSpeechInterrupt(): void {
  if (activeTurn) portalSpeechEnd(activeTurn, 'interrupted')
}

/** Legacy phase === speaking is intentionally not an audio-start signal. */
