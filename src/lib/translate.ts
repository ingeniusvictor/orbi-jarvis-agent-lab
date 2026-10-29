/** LT-01 — explicit language pair, not an always-on language detector. */
import { BRIDGE_HTTP_URL } from '../config'
export type TranslationLanguage = 'es' | 'en' | 'zh'
export const TRANSLATION_CHOICES: ReadonlyArray<{value: TranslationLanguage; label: string}> = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文 (mandarín)' },
]
export async function translateLocalText(
  text: string, source: TranslationLanguage, target: TranslationLanguage,
): Promise<string> {
  if (source === target) throw new Error('Selecciona dos idiomas diferentes.')
  if (!text.trim() || text.length > 4000) throw new Error('Introduce un texto de hasta 4000 caracteres.')
  const res = await fetch(BRIDGE_HTTP_URL + '/translate/local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), source, target }),
  })
  let data: { ok?: boolean; translation?: string; error?: string } = {}
  try { data = await res.json() } catch { /* preserve generic error */ }
  if (!res.ok || !data.ok || !data.translation)
    throw new Error(data.error || 'El traductor local no respondió.')
  return data.translation
}
