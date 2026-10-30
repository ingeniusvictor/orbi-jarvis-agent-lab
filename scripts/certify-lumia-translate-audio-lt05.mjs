import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  validateTranslationWav, translationWhisperArgs,
  AUDIO_TRANSLATE_MAX_SECONDS, AUDIO_TRANSLATE_MAX_WAV_BYTES,
} from '../bridge/orbia/translation-audio-stt.mjs'

const wav=(seconds=2)=>{
  const data=Buffer.alloc(seconds*16000*2+44)
  data.write('RIFF',0)
  data.writeUInt32LE(data.length-8,4)
  data.write('WAVE',8)
  data.write('fmt ',12)
  data.writeUInt32LE(16,16)
  data.writeUInt16LE(1,20)
  data.writeUInt16LE(1,22)
  data.writeUInt32LE(16000,24)
  data.writeUInt32LE(32000,28)
  data.writeUInt16LE(2,32)
  data.writeUInt16LE(16,34)
  data.write('data',36)
  data.writeUInt32LE(data.length-44,40)
  return data
}
assert.equal(AUDIO_TRANSLATE_MAX_SECONDS,90)
assert.ok(AUDIO_TRANSLATE_MAX_WAV_BYTES >= wav(90).length)
for(const lang of ['es','en','zh']) {
  assert.equal(validateTranslationWav(wav(),lang).language,lang)
  assert.deepEqual(translationWhisperArgs({
    model:'ggml-base.bin',wavPath:'voice.wav',outputPrefix:'transcript',language:lang,
  }), ['-m','ggml-base.bin','-f','voice.wav','-l',lang,'-nt','-otxt','-of','transcript'])
}
assert.throws(()=>validateTranslationWav(wav(),'auto'),e=>e.code==='INVALID_LANGUAGE')
assert.throws(()=>translationWhisperArgs({
  model:'ggml-base.en.bin',wavPath:'x',outputPrefix:'y',language:'zh',
}),e=>e.code==='MULTILINGUAL_MODEL_REQUIRED')
const stereo=wav()
stereo.writeUInt16LE(2,22)
assert.throws(()=>validateTranslationWav(stereo,'es'),e=>e.code==='INVALID_AUDIO')
const wrongRate=wav()
wrongRate.writeUInt32LE(44100,24)
assert.throws(()=>validateTranslationWav(wrongRate,'zh'),e=>e.code==='INVALID_AUDIO')
const badHeader=wav()
badHeader.write('RIFX',0)
assert.throws(()=>validateTranslationWav(badHeader,'en'),e=>e.code==='INVALID_AUDIO')
assert.throws(()=>validateTranslationWav(wav(91),'zh'),e=>e.code==='INVALID_AUDIO')
assert.throws(()=>validateTranslationWav(wav().subarray(0,60),'en'),e=>e.code==='INVALID_AUDIO')
assert.throws(()=>validateTranslationWav(Buffer.alloc(2),'en'),e=>e.code==='INVALID_AUDIO')

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const stt=read('bridge/orbia/translation-audio-stt.mjs')
const api=read('bridge/server.mjs')
const composer=read('src/ui/LumiaComposer.tsx')
const uiBridge=read('src/lib/translate.ts')
const app=read('src/App.tsx')
const wavSource=read('src/lib/wav.ts')
const launcher=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(stt,/mkdtemp\(join\(tmpdir\(\),'lumia-lt05-'\)\)/)
assert.match(stt,/await rm\(dir,\{recursive:true,force:true\}\)/)
assert.match(stt,/localVoicePaths\(env\)/)
assert.doesNotMatch(stt,/normalizeContextualEverydaySpeechText|ORBI_SPEECH_INITIAL_PROMPT|whisper-server/i)
assert.match(api,/\/translate\/audio\?/)
assert.match(api,/ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED !== '1'/)
assert.match(api,/AUDIO_TRANSLATE_MAX_WAV_BYTES/)
assert.match(api,/translateAudioActive=true/)
assert.match(api,/translateAudioActive=false/)
assert.match(api,/originalText:transcript\.text/)
assert.match(api,/stage:'stt'/)
assert.match(api,/stage:'translation'/)
assert.match(api,/source=url\.searchParams\.get\('source'\)/) // check explicit language via parsing
assert.match(uiBridge,/audioBlobToPcmWav\(file,16_000,MAX_TRANSLATION_AUDIO_SECONDS\)/)
assert.match(uiBridge,/MAX_TRANSLATION_AUDIO_FILE_BYTES = 12 \* 1024 \* 1024/)
assert.match(composer,/onTranslateAudio\(audioFile, sourceLanguage, targetLanguage\)/)
assert.match(composer,/translateEnabled \? audioInput : photoInput/)
assert.match(composer,/aria-label="Quitar audio adjunto"/)
assert.match(composer,/setTranslateEnabled\(!translateEnabled\)/)
assert.match(composer,/disabled=\{busy \|\| preparing \|\| translateEnabled\}/)
assert.match(app,/onTranslateAudio=\{translateAudioNote\}/)
assert.match(app,/Transcripción original/)
assert.match(app,/Traducción al/)
const hud=read('src/ui/Hud.tsx')
const css=read('src/index.css')
assert.match(hud,/turn\.text\.startsWith\('Transcripción original \('/)
assert.match(hud,/voice-line-translation-audio/)
assert.match(css,/\.voice-line-translation-audio \.voice-line-text \{[\s\S]*?white-space: pre-line;/)
assert.match(app,/result\.originalText\+'\\n\\nTraducción al '/)
assert.match(wavSource,/maxDurationSeconds\?: number/)
assert.match(launcher,/ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED=1/)
console.log('LT-05: 3 explicit languages, WAV safety, pure local model, attachment UX, dual result and privacy PASS')
