/**
 * LT-05: private, owner-selected voice note -> offline multilingual Whisper CLI.
 * Separate from the Spanish always-on/wake-word STT. Input format is bounded
 * 16 kHz 16-bit mono PCM WAV, produced by the browser after decoding the file.
 * No network, no speech-vocabulary rewrites, no persistent audio/transcripts.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { localVoicePaths, probeLocalVoiceCapabilities } from './local-voice-probe.mjs'

const run = promisify(execFile)
export const AUDIO_TRANSLATE_MAX_SECONDS = 90
export const AUDIO_TRANSLATE_MAX_WAV_BYTES = 3_000_000
export const AUDIO_TRANSLATE_STT_TIMEOUT_MS = 120_000
export const AUDIO_TRANSLATE_LANGUAGES = Object.freeze(['es','en','zh'])

export class LocalAudioTranslationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LocalAudioTranslationError'
    this.code = code
  }
}

export function validateTranslationWav(audio, language) {
  if (!AUDIO_TRANSLATE_LANGUAGES.includes(language)) {
    throw new LocalAudioTranslationError('INVALID_LANGUAGE',
      'Selecciona español, inglés o mandarín como idioma de origen.')
  }
  if (!Buffer.isBuffer(audio) || audio.length <= 44 ||
      audio.length > AUDIO_TRANSLATE_MAX_WAV_BYTES) {
    throw new LocalAudioTranslationError('INVALID_AUDIO',
      'El audio convertido está vacío o supera el límite de 90 segundos.')
  }
  if (audio.toString('ascii',0,4)!=='RIFF' || audio.toString('ascii',8,12)!=='WAVE' ||
      audio.toString('ascii',12,16)!=='fmt ' || audio.toString('ascii',36,40)!=='data' ||
      audio.readUInt16LE(20)!==1 || audio.readUInt16LE(22)!==1 ||
      audio.readUInt32LE(24)!==16000 || audio.readUInt16LE(34)!==16 ||
      audio.readUInt16LE(32)!==2 ||
      audio.readUInt32LE(40)!==audio.length-44 ||
      audio.readUInt32LE(4)!==audio.length-8) {
    throw new LocalAudioTranslationError('INVALID_AUDIO',
      'Se necesita WAV PCM mono de 16 kHz y 16 bits.')
  }
  const seconds=(audio.length-44)/32_000
  if (seconds > AUDIO_TRANSLATE_MAX_SECONDS) {
    throw new LocalAudioTranslationError('INVALID_AUDIO',
      'El mensaje dura más de 90 segundos. Divídelo en audios más cortos.')
  }
  return Object.freeze({ language, seconds })
}

export function translationWhisperArgs({ model, wavPath, outputPrefix, language }) {
  if (!AUDIO_TRANSLATE_LANGUAGES.includes(language))
    throw new LocalAudioTranslationError('INVALID_LANGUAGE','Idioma no válido.')
  if (!model || /\.en\.bin$/i.test(model)) {
    throw new LocalAudioTranslationError('MULTILINGUAL_MODEL_REQUIRED',
      'Se necesita un modelo Whisper multilingüe (ggml-base.bin o ggml-small.bin).')
  }
  // Explicit -l and NO Spanish-only initial prompt or regional rewrites.
  return ['-m',model,'-f',wavPath,'-l',language,'-nt','-otxt','-of',outputPrefix]
}

export async function transcribeTranslationAudio(
  audio, { language, env=process.env, timeoutMs=AUDIO_TRANSLATE_STT_TIMEOUT_MS }={},
) {
  const {seconds}=validateTranslationWav(audio,language)
  const ready=probeLocalVoiceCapabilities({env})
  if (!ready.stt.localAvailable) {
    throw new LocalAudioTranslationError('STT_NOT_INSTALLED',
      'Whisper local no está instalado o no encuentra su modelo.')
  }
  const {whisperCommand,whisperModel}=localVoicePaths(env)
  if (/\.en\.bin$/i.test(whisperModel)) {
    throw new LocalAudioTranslationError('MULTILINGUAL_MODEL_REQUIRED',
      'Whisper English-only no sirve para español ni mandarín; usa ggml-base.bin.')
  }
  const dir=await mkdtemp(join(tmpdir(),'lumia-lt05-'))
  try {
    const wavPath=join(dir,'voice.wav')
    const prefix=join(dir,'transcript')
    await writeFile(wavPath,audio)
    const args=translationWhisperArgs({model:whisperModel,wavPath,outputPrefix:prefix,language})
    const start=performance.now()
    try {
      await run(whisperCommand,args,{timeout:timeoutMs,windowsHide:true,maxBuffer:65536})
    } catch(err) {
      if(err?.code==='ENOENT')
        throw new LocalAudioTranslationError('STT_NOT_INSTALLED','No se encuentra Whisper CLI local.')
      if(err?.code==='ETIMEDOUT' || err?.killed)
        throw new LocalAudioTranslationError('STT_TIMEOUT','Whisper tardó demasiado en transcribir este mensaje.')
      throw new LocalAudioTranslationError('STT_FAILED','Whisper no pudo transcribir el audio seleccionado.')
    }
    const text=(await readFile(prefix+'.txt','utf8').catch(()=>'')).
      replace(/\s+/g,' ').trim()
    if (!text || /^\s*\[(?:music|música|silence|silencio|applause|aplausos)\]\s*$/iu.test(text)) {
      throw new LocalAudioTranslationError('STT_EMPTY',
        'No se detectó voz reconocible. Comprueba el idioma seleccionado.')
    }
    if (text.length>4000) {
      throw new LocalAudioTranslationError('STT_TOO_LONG',
        'La transcripción es demasiado larga para esta primera versión.')
    }
    return Object.freeze({
      text,language,durationSeconds:Math.round(seconds*10)/10,
      sttMs:Math.round(performance.now()-start),
    })
  } finally {
    await rm(dir,{recursive:true,force:true})
  }
}
