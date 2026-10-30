import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAudioTranslationReview, formatAudioTranslationReview } from '../src/lib/audio-translation-review'

const raw='Although I used the AI as a technical, I am not more than you know.'
const translation='Aunque utilicé la IA en un contexto técnico, no sé más que tú.'
const initial='Transcripción original (inglés):\n'+raw+
  '\n\nTraducción al español:\n'+translation
const parsed=parseAudioTranslationReview(initial)
assert.ok(parsed)
assert.equal(parsed.source,'en')
assert.equal(parsed.target,'es')
assert.equal(parsed.rawTranscript,raw)
assert.equal(parsed.correctedTranscript,null)
assert.equal(parsed.translation,translation)
const corrected='Although I used AI for technical work, I do not know more than you.'
const revised=formatAudioTranslationReview(parsed,corrected,
  'Aunque utilicé IA para trabajos técnicos, no sé más que tú.')
assert.match(revised,/Transcripción original \(inglés\):\nAlthough I used/)
assert.match(revised,/Transcripción corregida \(inglés\):\nAlthough I used AI/)
assert.match(revised,/\n\nTraducción al español:\nAunque utilicé IA/)
const parsedAgain=parseAudioTranslationReview(revised)
assert.ok(parsedAgain)
assert.equal(parsedAgain.rawTranscript,raw)
assert.equal(parsedAgain.correctedTranscript,corrected)
const twice=formatAudioTranslationReview(parsedAgain,
  'Although I used artificial intelligence for technical work.',
  'Aunque utilicé inteligencia artificial para trabajos técnicos.')
assert.equal((twice.match(/Transcripción original/g)??[]).length,1)
assert.equal((twice.match(/Transcripción corregida/g)??[]).length,1)
assert.match(twice,/Transcripción original \(inglés\):\nAlthough I used the AI/)
assert.equal(parseAudioTranslationReview('Traducción al inglés: Hello.'),null)
assert.equal(parseAudioTranslationReview('Transcripción original (inglés):\nHola'),null)
assert.equal(parseAudioTranslationReview('Transcripción original (inglés):\nText\n\nTraducción al inglés:\nHi'),null)
assert.equal(parseAudioTranslationReview('Transcripción original (inglés):\nText\n\nTraducción al chino:\n你好'),null)
assert.equal(parseAudioTranslationReview('Transcripción original (inglés):\nText\n\nTraducción al español:\n'),null)
assert.throws(()=>formatAudioTranslationReview(parsed,' ','Hola'),/inválida/)
assert.throws(()=>formatAudioTranslationReview(parsed,'x'.repeat(4001),'Hola'),/inválida/)
const chinese='Transcripción original (mandarín):\n你好，工程师。'+
  '\n\nTraducción al español:\nHola, ingeniero.'
const data=parseAudioTranslationReview(chinese)
assert.ok(data)
assert.equal(data.source,'zh')
assert.equal(data.target,'es')
assert.match(formatAudioTranslationReview(data,'你好，技术工程师。','Hola, ingeniero técnico.'),
  /Transcripción corregida \(mandarín\)/)

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const component=read('src/ui/AudioTranslationReview.tsx')
const hud=read('src/ui/Hud.tsx')
const css=read('src/index.css')
assert.match(hud,/<AudioTranslationReview turnId=\{turn\.id\} text=\{turn\.text\}/)
assert.match(component,/translateLocalText\(corrected,data\.source,data\.target\)/)
assert.match(component,/useStore\.getState\(\)\.updateTurn\(turnId/)
assert.match(component,/current\.text!==text/)
assert.match(component,/setEditing\(false\)/)
assert.match(component,/role="alert"/)
assert.match(component,/Cancelar/)
assert.match(component,/Retraducir/)
assert.match(component,/maxLength=\{4000\}/)
assert.doesNotMatch(component,/translateLocalAudioFile|audioBlobToPcmWav|transcribeTranslationAudio/)
assert.match(css,/\.lumia-audio-review-editor/)
assert.match(css,/\.lumia-audio-review-actions/)
console.log('LT-05B: original Whisper evidence preserved; per-turn edit/retranslate; no audio reprocessing PASS')
