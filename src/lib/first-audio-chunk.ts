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

// ASUS opt-in, not the default. Short initial WAV for local Kokoro only.
const FAST_LOCAL_MIN_CHARS = 32
const FAST_LOCAL_TARGET_CHARS = 56
const FAST_LOCAL_MAX_CHARS = 88

/**
 * Returns a boundary after a complete word, or null when there is not yet
 * enough safe text. Splitting there and joining the parts reconstructs the
 * original text; no words are dropped or repeated.
 *
 * Prefer a natural clause break (comma, semicolon, colon or dash). If a model
 * streams a very long unpunctuated clause, make one bounded fallback cut near
 * TARGET_FIRST_CHARS. The rest of the answer still uses sentence boundaries.
 */
export function findEarlySpeechBoundary(
  buffer: string,
  { fastLocal = false }: { fastLocal?: boolean } = {},
): number | null {
  const minChars = fastLocal ? FAST_LOCAL_MIN_CHARS : MIN_FIRST_CHARS
  const targetChars = fastLocal ? FAST_LOCAL_TARGET_CHARS : TARGET_FIRST_CHARS
  const maxChars = fastLocal ? FAST_LOCAL_MAX_CHARS : MAX_FIRST_CHARS
  if (typeof buffer !== 'string' || buffer.length < minChars) {
    return null
  }

  const clauseEnd = /[,;:—–][ \t]+|\n[ \t]*/g
  let match: RegExpExecArray | null
  while ((match = clauseEnd.exec(buffer))) {
    const end = match.index + match[0].length
    if (end >= minChars && end <= maxChars) {
      return end
    }
    if (end > maxChars) break
  }

  if (buffer.length < maxChars) return null

  const atTarget = buffer.lastIndexOf(' ', targetChars)
  if (atTarget >= minChars) return atTarget + 1

  // Languages with unusually long tokens: do not cut a word in half.
  const atMax = buffer.lastIndexOf(' ', maxChars)
  return atMax >= minChars ? atMax + 1 : null
}
