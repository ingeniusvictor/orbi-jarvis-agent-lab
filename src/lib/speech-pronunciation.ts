/**
 * TTS-only pronunciation exceptions. Keep the visible canonical identity
 * L.U.M.I.A. intact in the conversation transcript and model history.
 *
 * Kokoro and other engines should say "Lumia" as one name, not L-U-M-I-A.
 * Do not remove punctuation from other acronyms such as O.R.B.I.A. or MPPT.
 */
const DOTTED_LUMIA = /\bL\s*\.\s*U\s*\.\s*M\s*\.\s*I\s*\.\s*A\s*\.(?![\p{L}\p{N}])/giu

export function normalizeSpokenLumiaName(text: string): string {
  return text.replace(DOTTED_LUMIA, 'Lumia')
}

/**
 * Ollama may stream "L. U. M. I. A." one character at a time. Do not let
 * the generic sentence-end detector cut a standalone "L. " before the
 * complete name has arrived. Wait only for a potential *suffix* of the name;
 * the final buffered text still flushes normally on speaker.end().
 */
const PARTIAL_DOTTED_LUMIA = /(?:^|[^\p{L}\p{N}])L\s*\.(?:\s*U\s*\.?(?:\s*M\s*\.?(?:\s*I\s*\.?(?:\s*A\s*\.?)?)?)?)?\s*$/iu

export function isIncompleteLumiaSpelling(text: string): boolean {
  return PARTIAL_DOTTED_LUMIA.test(text)
}
