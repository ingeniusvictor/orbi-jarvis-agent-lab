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
