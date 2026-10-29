import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOllamaReplyGate } from '../bridge/orbia/ollama-json-stream.mjs'
import {
  normalizeTechnicalSpeechText,
  normalizeContextualEverydaySpeechText,
  ORBI_SPEECH_INITIAL_PROMPT,
} from '../bridge/orbia/speech-vocabulary.mjs'

assert.match(ORBI_SPEECH_INITIAL_PROMPT, /IA local/)
assert.equal(normalizeContextualEverydaySpeechText('Vamos a hacer una arriba.'), 'Vamos a hacer una arepa.')
assert.equal(normalizeContextualEverydaySpeechText('¿Cómo hacer una repa venezolana?'), '¿Cómo hacer una arepa venezolana?')
assert.equal(normalizeContextualEverydaySpeechText('Quiero preparar una repa.'), 'Quiero preparar una arepa.')
assert.equal(normalizeContextualEverydaySpeechText('Pon una arriba de otra.'), 'Pon una arriba de otra.')
assert.equal(normalizeContextualEverydaySpeechText('La que está arriba es roja.'), 'La que está arriba es roja.')
assert.equal(normalizeContextualEverydaySpeechText('Y la comable.'), 'Y la comable.')
assert.equal(normalizeContextualEverydaySpeechText('[Música]'), '[Música]')
assert.match(ORBI_SPEECH_INITIAL_PROMPT, /inteligencia artificial local/)
assert.equal(normalizeTechnicalSpeechText('Lumi, necesito saber cómo trabajar en una y local.'),
  'Lumi, necesito saber cómo trabajar en IA local.')
assert.equal(normalizeTechnicalSpeechText('Lumi, necesito trabajar con una y local.'),
  'Lumi, necesito trabajar con IA local.')
assert.equal(normalizeTechnicalSpeechText('Quiero utilizar una y local'),
  'Quiero utilizar IA local')
assert.equal(normalizeTechnicalSpeechText('A lo local.'), 'A lo local.')
assert.equal(normalizeTechnicalSpeechText('E-A.'), 'E-A.')
assert.equal(normalizeTechnicalSpeechText('Necesito comprar una y local.'),
  'Necesito comprar una y local.')
assert.equal(normalizeTechnicalSpeechText('[Música] [Música]'), '[Música] [Música]')
assert.equal(normalizeTechnicalSpeechText('MPPT y MTTP'), 'MPPT y MPPT')

function runChunks(payload, step) {
  const output = []
  const gate = createOllamaReplyGate({ onText: (s) => output.push(s) })
  for (let i = 0; i < payload.length; i += step) gate.feed(payload.slice(i, i + step))
  return { answer: gate.finish(), chunks: output, combined: output.join('') }
}
for (const step of [1, 2, 3, 7, 30, 150]) {
  const json = JSON.stringify({
    respuesta: 'Claro, puedo ayudarte con una IA local. Primero revisemos Ollama y después las herramientas.',
  })
  const res = runChunks(json, step)
  assert.equal(res.answer, 'Claro, puedo ayudarte con una IA local. Primero revisemos Ollama y después las herramientas.')
  assert.equal(res.combined, res.answer)
  assert.ok(res.chunks.length > 0)
}

const escaped = 'Te explico: "IA local" puede funcionar sin pagar; modelo Qwen, conexión y voz.'
const e = runChunks(JSON.stringify({ respuesta: escaped }), 1)
assert.equal(e.answer, escaped)
assert.equal(e.combined, escaped)
const unicode = runChunks('{"respuesta":"Lumia te ayudará con una IA local y símbolos: \\u00f1, \\u00e1, \\u2603. Sigue adelante."}', 1)
assert.match(unicode.combined, /ñ, á, ☃/)

for(const invalid of [
  '{"thinking":"private","respuesta":"text"}',
  'Hola. Responderé.',
  '{"respuesta":123}',
  '{"respuesta":""}',
  '{"respuesta":"hola","other":"world"}',
]) {
  const gate = createOllamaReplyGate({ onText: () => {} })
  assert.throws(() => { gate.feed(invalid); gate.finish() })
}
const noLeaks = []
const privacyGate = createOllamaReplyGate({ onText: (s) => noLeaks.push(s) })
assert.throws(() => privacyGate.feed('{"analysis":"pensamiento privado"}'))
assert.equal(noLeaks.join(''), '')

const brain = readFileSync(new URL('../bridge/ollama.mjs', import.meta.url), 'utf8')
assert.match(brain, /const STREAM_VOICE = process\.env\.ORBIA_OLLAMA_VOICE_STREAM === '1'/)
assert.match(brain, /stream: true, think: false/)
assert.match(brain, /format: responseSchema/)
assert.match(brain, /if \(gate\.startedSpeaking\) throw error/)
assert.match(brain, /const raw = await runStructured\(messages\)/)
assert.match(brain, /const recent = Array\.isArray\(history\) \? history\.slice\(-2\) : \[\]/)
assert.match(brain, /\{ role: 'user', content: prompt \}/)
assert.match(brain, /runStructured\(retryMessages, 256\)/)
assert.match(brain, /JSON still invalid after one local retry/)
assert.match(brain, /done_reason=/)
assert.ok(!brain.includes('raw || \'No hubo contenido útil. Responde brevemente en español.\''))
console.log('LUMIA OF-01: active question retained in one local malformed-JSON retry: PASS')
assert.match(brain, /speed=\$\{/)

const avatar = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)
console.log('LUMIA RC-01 IA local vocabulary + conservative inference gate: PASS')
console.log('Streaming response gated, buffered fallback retained, avatar untouched: PASS')
