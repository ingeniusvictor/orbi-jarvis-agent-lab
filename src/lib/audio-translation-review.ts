/**
 * LT-05B: strict parsing of LUMIA's existing two-language file transcript.
 * Keep the raw Whisper result in the same turn for auditing and clipboard
 * export. A correction is an additional user-authored field, never a rewrite
 * of the evidence from Whisper. No file or audio is reprocessed on retry.
 */
import type { TranslationLanguage } from './translate'

const languageByLabel: Record<string,TranslationLanguage> = {
  'español':'es', 'inglés':'en', 'mandarín':'zh',
}
const labelByLanguage: Record<TranslationLanguage,string> = {
  es:'español',en:'inglés',zh:'mandarín',
}
export type AudioReviewData = {
  source:TranslationLanguage
  target:TranslationLanguage
  rawTranscript:string
  correctedTranscript:string | null
  translation:string | null
}
export function parseAudioTranslationReview(text:string):AudioReviewData|null {
  if (typeof text!=='string' || !text.startsWith('Transcripción original (')) return null
  const match=/^Transcripción original \((español|inglés|mandarín)\):\n([\s\S]+?)(?:\n\nTranscripción corregida \((español|inglés|mandarín)\):\n([\s\S]+?))?(?:\n\nTraducción al (español|inglés|mandarín):\n([\s\S]+))?$/u.exec(text)
  if (!match) return null
  const source=languageByLabel[match[1]]
  const rawTranscript=match[2]?.trim()
  const correctedTranscript=match[4]?.trim()||null
  const target=languageByLabel[match[5]]
  const translation=match[6]?.trim()||null
  if (!source || !rawTranscript || rawTranscript.length>4000 ||
      (correctedTranscript && correctedTranscript.length>4000) ||
      (match[3] && match[3]!==match[1]) || (match[5] && (!target || target===source)) ||
      (correctedTranscript && !target) || (!translation && !correctedTranscript)) return null
  // The original on a Qwen failure is valid: it has no target label. That
  // case must be excluded until target metadata exists; do not guess.
  return {source,target,rawTranscript,correctedTranscript,translation}
}
export function formatAudioTranslationReview(
  original:AudioReviewData, corrected:string, translation:string,
):string {
  const cleaned=corrected.trim()
  const result=translation.trim()
  if (!original.source || !original.target || !cleaned || cleaned.length>4000 ||
      !result || result.length>12000) throw new Error('Transcripción o traducción inválida.')
  return 'Transcripción original ('+labelByLanguage[original.source]+'):\n'+
    original.rawTranscript+
    '\n\nTranscripción corregida ('+labelByLanguage[original.source]+'):\n'+
    cleaned+
    '\n\nTraducción al '+labelByLanguage[original.target]+':\n'+result
}
