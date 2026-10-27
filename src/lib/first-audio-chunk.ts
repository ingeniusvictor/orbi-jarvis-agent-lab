/**
 * L.U.M.I.A. VL-01 — conservative first-audio chunking.
 *
 * Streaming answers often start with a long sentence, so waiting for a full
 * stop before sending anything to TTS makes the voice feel unresponsive.
 * This pure function finds an EARLY, word-safe boundary for the first chunk.
 *
 * It does not inspect commands, authorize tools, touch microphones, or mutate
 * the model stream. Sentence-first handling in tts.ts stays authoritative.
 */
const MIN_FIRST_CHARS = 52
const TARGET_FIRST_CHARS = 96
const MAX_FIRST_CHARS = 148

/**
 * Returns a boundary after a complete word, or null when there is not yet
 * enough safe text. Splitting there and joining the parts reconstructs the
 * original text; no words are dropped or repeated.
 *
 * Prefer a natural clause break (comma, semicolon, colon or dash). If a model
 * streams a very long unpunctuated clause, make one bounded fallback cut near
 * TARGET_FIRST_CHARS. The rest of the answer still uses sentence boundaries.
 */
export function findEarlySpeechBoundary(buffer: string): number | null {
  if (typeof buffer !== 'string' || buffer.length < MIN_FIRST_CHARS) {
    return null
  }

  const clauseEnd = /[,;:—–][ \t]+|\n[ \t]*/g
  let match: RegExpExecArray | null
  while ((match = clauseEnd.exec(buffer))) {
    const end = match.index + match[0].length
    if (end >= MIN_FIRST_CHARS && end <= MAX_FIRST_CHARS) {
      return end
    }
    if (end > MAX_FIRST_CHARS) break
  }

  if (buffer.length < MAX_FIRST_CHARS) return null

  const atTarget = buffer.lastIndexOf(' ', TARGET_FIRST_CHARS)
  if (atTarget >= MIN_FIRST_CHARS) return atTarget + 1

  // Languages with unusually long tokens: do not cut a word in half.
  const atMax = buffer.lastIndexOf(' ', MAX_FIRST_CHARS)
  return atMax >= MIN_FIRST_CHARS ? atMax + 1 : null
}
