import assert from 'node:assert/strict'
import {
  isPcmWav,
  transcribeLocalWav,
} from '../bridge/orbia/local-stt.mjs'
import {
  isWave,
  synthesizeLocalSpeech,
} from '../bridge/orbia/local-tts.mjs'
import {
  normalizeTechnicalSpeechText,
  ORBI_SPEECH_INITIAL_PROMPT,
  ORBI_SPEECH_VOCABULARY,
} from '../bridge/orbia/speech-vocabulary.mjs'

const wav = new Uint8Array(44)
for (const [offset, text] of [
  [0, 'RIFF'],
  [8, 'WAVE'],
]) {
  for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i)
}

assert.equal(isPcmWav(wav), true)
assert.equal(isWave(wav), true)
assert.equal(isPcmWav(new Uint8Array(10)), false)
assert.equal(isWave(new Uint8Array(10)), false)

await assert.rejects(
  () => transcribeLocalWav(new Uint8Array(0)),
  /invalid|allowed size/i,
)
await assert.rejects(
  () => synthesizeLocalSpeech(''),
  /invalid|allowed size/i,
)

assert.ok(ORBI_SPEECH_VOCABULARY.includes('Qwen'))
assert.ok(ORBI_SPEECH_VOCABULARY.includes('L.U.M.I.A.'))
assert.match(ORBI_SPEECH_INITIAL_PROMPT, /Qwen/)
assert.match(ORBI_SPEECH_INITIAL_PROMPT, /Ollama/)
assert.equal(
  normalizeTechnicalSpeechText('Explícame qué es un MTTP.'),
  'Explícame qué es un MPPT.',
)
assert.equal(
  normalizeTechnicalSpeechText('Explícame qué es un MPTT.'),
  'Explícame qué es un MPPT.',
)
assert.equal(
  normalizeTechnicalSpeechText('Escuché solo una M.'),
  'Escuché solo una M.',
)
assert.equal(
  normalizeTechnicalSpeechText('Explícame qué es un UMPPT.'),
  'Explícame qué es un MPPT.',
)

console.log('C1-E local voice adapter contract smoke test: PASS')
console.log('STT: PCM WAV guard + bounded invalid-input handling')
console.log('TTS: WAV guard + bounded invalid-text handling')
console.log('Vocabulary: ORBI/LUMIA/Qwen/Ollama recognition hints present')
