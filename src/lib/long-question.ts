/**
 * LUMIA LC-01 — opt-in, bounded local long-question reception.
 * A 20-second VAD segment is NOT the end of a 60-second dictated question.
 * The pure rules below never grant wake, identity or tool permissions.
 */
export const LONG_QUESTION_SEGMENT_THRESHOLD_MS = 8_000
export const LONG_QUESTION_CAPTURE_CAP_MS = 100_000
export const LONG_QUESTION_AFTER_TRANSCRIPT_MS = 2_400
export const LONG_QUESTION_ASSEMBLY_CAP_MS = 90_000
export const LONG_QUESTION_POLL_MS = 250

export function isLongCommandSegment(
  mode: string, durationMs: number, enabled: boolean,
): boolean {
  return enabled && mode === 'command' && Number.isFinite(durationMs) &&
    durationMs >= LONG_QUESTION_SEGMENT_THRESHOLD_MS
}

/** Silence, queued STT and an active continuation are three different clocks. */
export function shouldDeferLongQuestion({
  active, elapsedFromFirstMs, elapsedFromLastMs,
  queuedCommand, recordingCommand,
}: {
  active: boolean
  elapsedFromFirstMs: number
  elapsedFromLastMs: number
  queuedCommand: boolean
  recordingCommand: boolean
}): boolean {
  if (!active || elapsedFromFirstMs >= LONG_QUESTION_ASSEMBLY_CAP_MS) return false
  return queuedCommand || recordingCommand ||
    elapsedFromLastMs < LONG_QUESTION_AFTER_TRANSCRIPT_MS
}

/** One extension is always relative to the original listen() opening time. */
export function remainingLongQuestionWindow(startedAtMs: number, nowMs: number): number {
  const delta = nowMs - startedAtMs
  return Number.isFinite(delta) && delta >= 0 && delta < LONG_QUESTION_CAPTURE_CAP_MS
    ? LONG_QUESTION_CAPTURE_CAP_MS - delta
    : 0
}
