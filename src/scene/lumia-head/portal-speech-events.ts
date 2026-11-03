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
let currentPhrase = ''
let currentPhraseStartedAt = 0

/** Allows a VRM that remounts mid-phrase to recover the active lip-sync. */
export function portalSpeechSnapshot(): { turnId: string | null; phrase: string; phraseStartedAt: number } {
  return { turnId: activeTurn, phrase: currentPhrase, phraseStartedAt: currentPhraseStartedAt }
}


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
  currentPhrase = ''
  currentPhraseStartedAt = performance.now() / 1000
  emit({ kind: 'start', turnId })
}

/** Called from onPhraseStart; text is what is *actually* being played. */
export function portalSpeechPhrase(turnId: string, text: string): void {
  if (activeTurn !== turnId) return
  currentPhrase = text
  currentPhraseStartedAt = performance.now() / 1000
  emit({ kind: 'phrase', turnId, text })
}

export function portalSpeechEnd(turnId: string, reason: 'complete' | 'interrupted' = 'complete'): void {
  if (activeTurn !== turnId) return
  activeTurn = null
  currentPhrase = ''
  currentPhraseStartedAt = 0
  emit({ kind: 'end', turnId, reason })
}

export function portalSpeechInterrupt(): void {
  if (activeTurn) portalSpeechEnd(activeTurn, 'interrupted')
}

/** Legacy phase === speaking is intentionally not an audio-start signal. */
