/**
 * Static recognition hint for local Whisper.cpp.
 *
 * This is not a knowledge source and does not rewrite user text. It only gives
 * the speech recogniser high-value technical vocabulary that general dictation
 * models frequently mishear.
 */
export const ORBI_SPEECH_VOCABULARY = Object.freeze([
  'ORBI',
  'O.R.B.I.A.',
  'LUMI',
  'L.U.M.I.A.',
  'ORBI Ecosystem',
  'ORBI PVMetrics',
  'Qwen',
  'Ollama',
  'Whisper',
  'Kokoro',
  'BESS',
  'MPPT',
  'Sungrow',
  'Huawei',
])

export const ORBI_SPEECH_INITIAL_PROMPT =
  `Contexto de terminología técnica: ${ORBI_SPEECH_VOCABULARY.join(', ')}.`


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
