/**
 * Static recognition hint for local Whisper.cpp.
 *
 * This is not a knowledge source and does not rewrite user text. It only gives
 * the speech recogniser a small amount of high-value vocabulary that general
 * dictation models frequently mishear.
 *
 * Keep this list intentionally small. Repeating assistant identity variants in
 * the Whisper prompt can bias quiet/background audio toward hallucinating wake
 * words, which is exactly the failure mode we want to avoid in always-on voice.
 */
export const ORBI_SPEECH_VOCABULARY = Object.freeze([
  'Lumi',
  'ORBI',
  'Qwen',
  'Ollama',
  'Whisper',
  'Kokoro',
  'BESS',
  'MPPT',
  'Sungrow',
  'Huawei',
])

/**
 * Command-mode hint only. Wake/guard audio must not receive this prompt: a
 * technical prompt makes Whisper much more likely to invent one of these terms
 * from music, room noise or very weak speech.
 */
export const ORBI_SPEECH_INITIAL_PROMPT =
  `Vocabulario técnico posible: ${ORBI_SPEECH_VOCABULARY.join(', ')}.`


/**
 * Conservative post-ASR cleanup for high-confidence technical acronym errors.
 *
 * This is intentionally tiny. We only normalize variants observed in local
 * testing where all four acronym letters are present but transposed by Whisper.
 * Incomplete fragments such as a lone "M" are never expanded.
 */
export function normalizeTechnicalSpeechText(value) {
  return String(value ?? '')
    .replace(/\bM\s*P\s*T\s*T\b/giu, 'MPPT')
    .replace(/\bM\s*T\s*T\s*P\b/giu, 'MPPT')
    .replace(/\bM\s*P\s*P\s*T\b/giu, 'MPPT')
    .replace(/\bMTTP\b/giu, 'MPPT')
    .replace(/\bMPTT\b/giu, 'MPPT')
    .replace(/\bUMPPT\b/giu, 'MPPT')
    .replace(/\bU\s*M\s*P\s*P\s*T\b/giu, 'MPPT')
    .trim()
}
