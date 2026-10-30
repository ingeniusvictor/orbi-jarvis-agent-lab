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


/** LT-05: owner-selected WhatsApp/local voice notes, never open microphone. */
import { audioBlobToPcmWav } from './wav'
export const MAX_TRANSLATION_AUDIO_FILE_BYTES = 12 * 1024 * 1024
export const MAX_TRANSLATION_AUDIO_SECONDS = 90
const TRANSLATION_AUDIO_EXTENSIONS = /\.(?:ogg|opus|mp3|m4a|mp4|wav|webm|aac)$/i

export interface AudioTranslationResult {
  originalText: string
  translation: string
  source: TranslationLanguage
  target: TranslationLanguage
  durationSeconds: number
  sttMs: number
  translationMs: number
}
export class AudioTranslationError extends Error {
  readonly originalText?: string
  constructor(message:string, originalText?:string) {
    super(message)
    this.name='AudioTranslationError'
    this.originalText=originalText
  }
}
export function validateTranslationAudioFile(file: Pick<File,'size'|'name'|'type'>): void {
  if (file.size<=0 || file.size>MAX_TRANSLATION_AUDIO_FILE_BYTES) {
    throw new AudioTranslationError('Selecciona un audio de hasta 12 MB.')
  }
  const type=file.type.split(';')[0].toLowerCase()
  if (!TRANSLATION_AUDIO_EXTENSIONS.test(file.name) &&
      !['audio/ogg','audio/opus','audio/mpeg','audio/mp4','audio/x-m4a',
        'audio/wav','audio/x-wav','audio/webm','audio/aac'].includes(type)) {
    throw new AudioTranslationError('Archivo no compatible: usa OGG, OPUS, MP3, M4A, AAC, WEBM o WAV.')
  }
}
export async function translateLocalAudioFile(
  file:File, source:TranslationLanguage, target:TranslationLanguage,
):Promise<AudioTranslationResult> {
  if (source===target) throw new AudioTranslationError('Selecciona dos idiomas diferentes.')
  validateTranslationAudioFile(file)
  let wav:Blob
  try {
    // Chromium can decode most desktop WhatsApp audio exports, including OGG
    // Opus, but codec support depends on the OS/browser. Fail explicitly.
    wav=await audioBlobToPcmWav(file,16_000,MAX_TRANSLATION_AUDIO_SECONDS)
  } catch(err) {
    if (err instanceof Error && err.message.includes('supera los')) throw err
    throw new AudioTranslationError(
      'Chrome no pudo abrir este formato de audio. Convierte el mensaje a WAV o MP3 localmente.'
    )
  }
  const url = BRIDGE_HTTP_URL + '/translate/audio?source=' + encodeURIComponent(source) +
    '&target=' + encodeURIComponent(target)
  let response:Response
  try {
    response=await fetch(url,{
      method:'POST', headers:{'content-type':'audio/wav'}, body:wav,
    })
  } catch {
    throw new AudioTranslationError('No se pudo conectar con el traductor local de LUMIA.')
  }
  let data: {
    ok?:boolean; originalText?:string; translation?:string;
    source?:TranslationLanguage; target?:TranslationLanguage;
    durationSeconds?:number; sttMs?:number; translationMs?:number;
    error?:string;
  }={}
  try { data=await response.json() } catch { /* explicit fallback error */ }
  if(!response.ok || !data.ok || !data.originalText || !data.translation) {
    throw new AudioTranslationError(
      data.error || 'No se pudo traducir el archivo de audio.',
      data.originalText,
    )
  }
  return {
    originalText:data.originalText,translation:data.translation,
    source:data.source??source,target:data.target??target,
    durationSeconds:data.durationSeconds??0,
    sttMs:data.sttMs??0,translationMs:data.translationMs??0,
  }
}
