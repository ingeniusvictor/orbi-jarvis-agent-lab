/**
 * VL-02: cautious, opt-in follow-up latency policy.
 *
 * The browser recognizer may emit delayed speech-synthesis echoes, so NEVER
 * shorten its original 2600ms guard. The local Whisper route has its own
 * speaker-shield and rolling echo reference; when explicitly enabled by the
 * owner on a test workstation, a slightly shorter guard may be evaluated.
 *
 * This function does not infer speaker identity, liveness or permission.
 */
export const DEFAULT_FOLLOWUP_GUARD_MS = 2600
export const LOCAL_FOLLOWUP_MIN_MS = 2050

export function resolveFollowupGuardMs({
  engine,
  fastLocalFollowup = false,
  echoTailMs = 1800,
}: {
  engine: string
  fastLocalFollowup?: boolean
  echoTailMs?: number
}): number {
  if (!fastLocalFollowup || engine !== 'whisper-local') {
    return DEFAULT_FOLLOWUP_GUARD_MS
  }
  // A minimum safety margin must remain beyond the TTS output echo tail.
  if (!Number.isFinite(echoTailMs) || echoTailMs < 0) {
    return DEFAULT_FOLLOWUP_GUARD_MS
  }
  return Math.max(LOCAL_FOLLOWUP_MIN_MS, Math.ceil(echoTailMs) + 250)
}
