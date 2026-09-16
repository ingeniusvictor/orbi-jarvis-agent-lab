/**
 * Voice Focus V0 — deterministic turn isolation for delayed transcription.
 *
 * Whisper transcription finishes after the audio segment itself. By the time a
 * transcript returns, another person may already be speaking and the app may
 * have moved into another phase. These helpers keep those later events from
 * being mistaken for a continuation of the original speaker's turn.
 */

export type FocusVoiceMode = 'wake' | 'command' | 'guard' | 'deaf'

/**
 * Audio captured while waiting for a command belongs to that command only.
 * Once the app has left command mode, any queued command segment is stale and
 * must not become a barge-in against the answer that just started.
 *
 * Guard segments are allowed to survive a transition to command because a
 * legitimate barge-in changes the mode before its transcription comes back.
 */
export function shouldDropStaleVoiceSegment(
  capturedMode: FocusVoiceMode,
  currentMode: FocusVoiceMode,
): boolean {
  if (capturedMode === 'deaf') return true
  if (capturedMode === 'wake') return currentMode !== 'wake'
  if (capturedMode === 'command') return currentMode !== 'command'
  return false
}

/**
 * A transcript arriving from a finished VAD segment is not evidence that the
 * same speaker is still talking. Using the microphone's *current* activity here
 * can accidentally attach a child, television or second speaker to the first
 * person's sentence while Whisper is still processing it.
 *
 * Continuation is instead decided from transcript text + assembler timing.
 */
export function transcriptSegmentIsStillActive(): false {
  return false
}


/**
 * Household Focus guard rule.
 *
 * While L.U.M.I.A. is thinking/speaking, background speech is visible in the
 * raw STT lane but must not interrupt the active answer unless the person
 * explicitly addresses L.U.M.I.A. or uses an override phrase.
 */
export function shouldInterruptBusyAssistant(
  text: string,
  {
    wake,
    override,
    bareWake,
  }: {
    wake: RegExp
    override: RegExp
    bareWake?: RegExp
  },
): boolean {
  const said = String(text ?? '').trim()
  if (!said) return false
  if (override.test(said)) return true

  // A bare "Lumi" in GUARD is much more likely to be loudspeaker residue than
  // an intentional household interruption. Require actual trailing speech
  // ("Lumi, para", "Lumi, escucha...") while busy.
  if (bareWake?.test(said)) return false

  return wake.test(said)
}


/**
 * Whisper sometimes emits bracketed acoustic annotations for music/noise.
 * They are useful evidence in ESCUCHANDO but must never become commands.
 */
export function isNonSpeechTranscript(text: string): boolean {
  const value = String(text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return /^(?:\[|\()?\s*(?:musica|music|silencio|silence|ruido|noise|aplausos|applause|risas|laughter)\s*(?:\]|\))?[.!?]*$/.test(
    value,
  )
}
