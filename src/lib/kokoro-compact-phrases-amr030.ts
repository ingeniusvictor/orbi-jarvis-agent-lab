/**
 * AMR-03.0: conservative, opt-in segmentation of *already generated* spoken
 * phrases for local Kokoro. It does not accelerate the model, cache audio,
 * change the TTS voice or start microphone/camera.
 *
 * Only phrases that exceed 112 chars are divided. Long words are never cut,
 * punctuation and text are preserved byte-for-byte, and no extra words appear.
 */
export const MAX_KOKORO_COMPACT_CHARS = 112
const MIN_PART_CHARS = 42
const TARGET_CHARS = 86

export function splitKokoroCompactPhrase(raw: string): string[] {
  if (typeof raw !== 'string' || raw.length <= MAX_KOKORO_COMPACT_CHARS) return [raw]
  const results: string[] = []
  let rest = raw
  while (rest.length > MAX_KOKORO_COMPACT_CHARS) {
    // Prefer commas, colons or semicolons at safe clause boundaries, not
    // absolute character cuts. Preserve all original characters.
    let cut = -1
    const punctuation = /[,;:—–]\s+/g
    for (const m of rest.matchAll(punctuation)) {
      const end = (m.index ?? 0) + m[0].length
      if (end >= MIN_PART_CHARS && end <= MAX_KOKORO_COMPACT_CHARS) {
        if (cut < 0 || Math.abs(end - TARGET_CHARS) < Math.abs(cut - TARGET_CHARS)) cut = end
      }
    }
    if (cut < 0) {
      // Require both a sufficiently long first and remaining fragment;
      // if impossible, leave the long phrase intact rather than cut a word.
      const preferred = Math.min(TARGET_CHARS, MAX_KOKORO_COMPACT_CHARS)
      const left = rest.lastIndexOf(' ', preferred)
      const right = rest.indexOf(' ', preferred)
      if (left >= MIN_PART_CHARS && rest.length-left-1 >= MIN_PART_CHARS) cut = left+1
      else if (right >= MIN_PART_CHARS && right <= MAX_KOKORO_COMPACT_CHARS
        && rest.length-right-1 >= MIN_PART_CHARS) cut = right+1
    }
    if (cut < MIN_PART_CHARS || rest.length-cut < MIN_PART_CHARS) break
    results.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  results.push(rest)
  return results
}
