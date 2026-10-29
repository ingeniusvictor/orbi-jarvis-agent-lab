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
  'IA local',
  'inteligencia artificial local',
  'Whisper',
  'Kokoro',
  'VRAM',
  'memoria de video',
  'GPU',
  'Explícame',
  'recomiéndame',
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
 * SR-01: very narrow corrections for everyday Spanish phrases observed in the
 * owner's local Whisper logs. This is NOT general spellcheck and must not
 * replace spatial "arriba", a person's name or unrelated conversation.
 * Intentionally does not change the wake word or create a new request.
 */
export function normalizeContextualEverydaySpeechText(value) {
  return String(value ?? '')
    // "Vamos a hacer una arriba" is an ASR acoustic substitution in the
    // culinary phrase "hacer una arepa"; never alter "ponla arriba".
    .replace(/\b((?:hacer|preparar|cocinar)\s+una\s+)(?:agarriba|arriba|repa|haripa|aripa|arripa)\b/giu,
      '$1arepa')
    // Regional dish context is strong; isolated names and similar-sounding
    // terms remain untouched. Command mode only receives vocabulary hints.
    .replace(/\b(?:repa|haripa|aripa|arripa)\s+(venezolan[ao]|llaner[ao])\b/giu,
      'arepa $1')
    // In the owner's transcript "tipos de rellenos ... en la ARIPA" had no
    // adjacent "venezolana". Require a food cue within the same short clause.
    .replace(
      /\b((?:rellenos?|rellen[ao]s?|harina|ma[ií]z|masa|queso|pollo|carne)\b[^.!?]{0,100}?\b(?:una|la|de|en|para)\s+)(?:haripa|aripa|repa|arripa|agarriba)\b/giu,
      '$1arepa',
    )
    // Whisper joins the wake name and an imperative: "Lumidime 5 formas".
    // Only correct a clause-opening vocative followed by a clear request.
    .replace(
      /^(\s*[¿¡]?)lumidime(?=\s+(?:\d+|qu[eé]|c[oó]mo|cu[aá]les|cu[aá]ntos|formas?\b))/iu,
      '$1Lumi, dime',
    )
}

/**
 * Conservative post-ASR cleanup for high-confidence technical acronym errors.
 *
 * This is intentionally tiny. We only normalize variants observed in local
 * testing where all four acronym letters are present but transposed by Whisper.
 * Incomplete fragments such as a lone "M" are never expanded.
 */
export function normalizeTechnicalSpeechText(value) {
  return String(value ?? '')
    // Observed on ASUS Whisper base/es: the command "Explícame cómo
    // funciona..." came back as "Pícame cómo funciona...". Only repair
    // this exact command-opening context, never arbitrary "pícame" speech.
    .replace(/^([\s¿¡]*)p[ií]came(?=\s+c[oó]mo\s+funciona\b)/iu, '$1Explícame')
    // Observed local command "4 gigas de VRAM" -> "4 gigas de Virran".
    // Require an explicit memory-size expression so people's names or
    // unrelated uses of the word Virran are not rewritten.
    .replace(/\b(\d{1,3}\s*(?:gigas?|gb|gigabytes?)\s+de\s+)virran\b/giu, '$1VRAM')
    // Whisper base/es can hear "IA local" as "una y local". Only repair
    // this exact acoustic variant within explicit technical intent. Never
    // rewrite short, contextless "A lo local", "E-A", or ordinary "una".
    .replace(
      /\b((?:trabajar|trabajo|usar|utilizar|configurar|entrenar|crear|instalar|programar|aprender|consultar|modelo|modelos|asistente|inteligencia artificial)[^.!?]{0,85}?)\buna\s+y\s+local\b/giu,
      '$1IA local',
    )
    .replace(/\bM\s*P\s*T\s*T\b/giu, 'MPPT')
    .replace(/\bM\s*T\s*T\s*P\b/giu, 'MPPT')
    .replace(/\bM\s*P\s*P\s*T\b/giu, 'MPPT')
    .replace(/\bMTTP\b/giu, 'MPPT')
    .replace(/\bMPTT\b/giu, 'MPPT')
    .replace(/\bUMPPT\b/giu, 'MPPT')
    .replace(/\bU\s*M\s*P\s*P\s*T\b/giu, 'MPPT')
    .trim()
}
