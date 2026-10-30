/**
 * L.U.M.I.A. VL-03 — deterministic, opt-in conversation turn policy.
 *
 * Provides conservative text and acoustic segmentation hints. The policy is
 * never an authority or identity check. Existing speaker/Voice Gate filters,
 * explicit transcript handling, tool permissions and interruption controls
 * must remain in front of any model/tool execution.
 */

export const BASELINE_VAD_SILENCE_MS = 650

export type TurnHoldDecision = Readonly<{
  holdMs: number
  reason: 'baseline' | 'brief-reply' | 'long-thought' | 'unfinished-ellipsis'
}>

const BRIEF_REPLIES = new Set([
  'si',
  'claro',
  'vale',
  'listo',
  'adelante',
  'continua',
  'continuemos',
  'sigue',
  'correcto',
  'perfecto',
  'de acuerdo',
  'muy bien',
  'dale',
  'gracias',
  'ok',
  'okay',
  'yes',
  'sure',
  'go ahead',
  'thanks',
])

const clean = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/[.,!?;:]+$/g, '').replace(/\s+/g, ' ')

export function decideTextTurnHold({
  text,
  baselineMs,
  settleMs,
  continueMs,
  segments = 1,
  enabled = false,
}: {
  text: string
  baselineMs: number
  settleMs: number
  continueMs: number
  segments?: number
  enabled?: boolean
}): TurnHoldDecision {
  const result = (holdMs: number, reason: TurnHoldDecision['reason']) =>
    Object.freeze({ holdMs, reason })

  // No auto-tuning with invalid data or without the owner's opt-in.
  if (!enabled || !Number.isFinite(baselineMs) ||
    !Number.isFinite(settleMs) || !Number.isFinite(continueMs) ||
    baselineMs < 0 || settleMs < 0 || continueMs < settleMs ||
    typeof text !== 'string' || !text.trim()) {
    return result(baselineMs, 'baseline')
  }

  const normalized = clean(text)

  // A dangling ellipsis is not a final full stop; preserve time for thought.
  // A normal ".", "?" or "!" remains zero-delay when the old policy says so.
  if (/(?:\.{2,}|…)\s*$/.test(text)) {
    return result(Math.max(baselineMs, continueMs), 'unfinished-ellipsis')
  }

  // Only isolated, explicitly complete short replies are advanced. A fragment
  // like "sí, pero" or "continúa con" is not in the exact-match list.
  // The recognition engine must ALREADY have endpointed before this is called.
  if (segments === 1 && BRIEF_REPLIES.has(normalized) &&
      baselineMs > 0 && !/[,;:—–-]\s*$/.test(text)) {
    return result(0, 'brief-reply')
  }

  // Modest improvement for LONG, single-segment sentences that the previous
  // policy already considered complete. Never overrule conjunction holds,
  // partial phrases, or punctuation-based immediate dispatch.
  const words = normalized.split(' ').filter(Boolean)
  if (segments === 1 && words.length >= 8 && baselineMs === settleMs &&
      !/[,;:—–-]\s*$/.test(text)) {
    return result(Math.max(170, settleMs - 70), 'long-thought')
  }

  return result(baselineMs, 'baseline')
}

export function chooseAcousticSilenceMs({
  voicedDurationMs,
  adaptive = false,
  guarded = false,
}: {
  voicedDurationMs: number
  adaptive?: boolean
  guarded?: boolean
}): number {
  // Browser recognition has its own clock. This policy is ONLY for local VAD.
  // Guarded audio (speaker/echo phase) must never become more sensitive.
  if (!adaptive || guarded || !Number.isFinite(voicedDurationMs) ||
      voicedDurationMs < 0) return BASELINE_VAD_SILENCE_MS

  // Brief utterances are protected against accidental truncation. Long spoken
  // segments can move to Whisper slightly earlier; the assembler still joins
  // fragments, and no policy may infer that a speaker is verified from timing.
  if (voicedDurationMs < 800) return 780
  if (voicedDurationMs >= 2500) return 580
  return BASELINE_VAD_SILENCE_MS
}
