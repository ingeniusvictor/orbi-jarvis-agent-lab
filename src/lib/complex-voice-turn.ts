/** VQ-01: interpret multiple QUESTIONS already accepted by the voice gate.
 * No wake permissions, diarization, or hallucinated reconstruction.
 */
export function multiQuestionCount(text) {
  const normalized=String(text??'').trim().slice(0,5000)
  if(!normalized) return 0
  const marks=(normalized.match(/[?？]/g)??[]).length
  // Recognizers often omit punctuation. Count only obvious, clause-level
  // question introductions, not every "que"/"como" inside ordinary speech.
  const starts=(normalized.match(/(?:^|[.!?;,]\s*|\s+(?:y|además|también|luego)\s+)(?:¿\s*)?(?:qué|que\s+(?:es|son|hace|pas[oó]|significa)|cu[aá]l(?:es)?|c[oó]mo|cu[aá]ndo|d[oó]nde|por\s+qu[eé]|cu[aá]nt[oa]s?|puedes|podr[ií]as|me\s+(?:dices|explicas)|dime|expl[ií]came)\b/giu)??[]).length
  // Two question marks in a single Spanish sentence means one question.
  const paired=Math.floor((normalized.match(/¿/g)??[]).length)
  return Math.min(6,Math.max(marks-paired, starts, paired))
}

export function isComplexSpokenTurn(text) {
  const value=String(text??'').trim()
  if(value.length<24) return false
  if(multiQuestionCount(value)>=2) return true
  // A connected long statement with multiple clauses also merits a coherent
  // synthesis rather than a reflexive one-sentence response.
  return value.split(/\s+/u).length>=42
}

/** A little extra assembly time only for obviously multipart turns. */
export function complexVoiceHoldMs(text, segmentCount, enabled) {
  if(!enabled||segmentCount<2||!isComplexSpokenTurn(text)) return 0
  return 850
}

/** The normal voice budget is untouched for ordinary short requests. */
export function complexVoiceTokenBudget(text, enabled) {
  return enabled && isComplexSpokenTurn(text) ? 320 : null
}

/** Never attempt to answer unattended background conversations. */
export function shouldProtectWhisperCommandAtExpiry({
  enabled, authorized, hasPending, expiredByMs,
}) {
  return Boolean(enabled&&authorized&&hasPending&&
    Number.isFinite(expiredByMs)&&expiredByMs>=0&&expiredByMs<12000)
}
