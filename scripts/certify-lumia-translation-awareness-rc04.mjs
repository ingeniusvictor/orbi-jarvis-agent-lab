import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  translationRuntimeStatus,
  rc04TranslationCapabilityReply,
} from '../bridge/orbia/translation-capabilities-rc04.mjs'

const all = {
  ORBIA_BRAIN_PROVIDER: 'ollama',
  ORBIA_LUMIA_TRANSLATE_ENABLED: '1',
  ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED: '1',
}
const textOnly = {...all, ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED: '0'}
const disabled = {...all, ORBIA_LUMIA_TRANSLATE_ENABLED: '0'}
const remote = {...all, ORBIA_BRAIN_PROVIDER: 'claude'}
const query = 'Lumi, comentame sobre tus capacidades para traducir audios y texto.'

assert.deepEqual(translationRuntimeStatus(all), {
  localProvider: true, textEnabled: true, audioEnabled: true,
})
const answer = rc04TranslationCapabilityReply({prompt: query, env: all})
assert.match(answer,/puedo traducir textos entre español, inglés y mandarín/i)
assert.match(answer,/Whisper local lo transcribe y Qwen local lo traduce/i)
assert.match(answer,/noventa segundos y doce megabytes/i)
assert.match(answer,/corregir la transcripción/i)
assert.match(answer,/no tengo interpretación simultánea continua/i)
assert.doesNotMatch(answer,/no puedo procesar archivos de audio/i)

const concise = rc04TranslationCapabilityReply({
  prompt:'Lumi, ¿qué capacidades tienes actualmente?',env:all,
})
assert.match(concise,/traducir texto/i)
assert.match(concise,/notas de voz/i)
assert.match(concise,/control general de tu computadora/i)

assert.match(rc04TranslationCapabilityReply({prompt:query,env:textOnly}),/audio está desactivada/i)
assert.doesNotMatch(rc04TranslationCapabilityReply({prompt:query,env:textOnly}),/Whisper local lo transcribe/i)
assert.match(rc04TranslationCapabilityReply({prompt:query,env:disabled}),/no está habilitado/i)
assert.match(rc04TranslationCapabilityReply({prompt:query,env:remote}),/no está habilitado/i)
assert.match(rc04TranslationCapabilityReply({
  prompt:'¿Puedes traducir archivos de audio?',env:all,
}),/archivos de voz guardados/i)

for (const prompt of [
  'Lumi como estás',
  'Lumi, ¿cómo estará el clima mañana?',
  'Traduce hola al inglés',
  'Tradúceme esto: Hola mundo',
  'Necesito que traduzcas esta carta',
  'Te voy a enviar una grabación para traducir',
]) assert.equal(rc04TranslationCapabilityReply({prompt,env:all}),null,'Never hijack: '+prompt)

const brain = readFileSync(new URL('../bridge/ollama.mjs',import.meta.url),'utf8')
const launcher = readFileSync(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url),'utf8')
assert.match(brain,/ORBIA_LUMIA_RC04_CAPABILITIES === '1'/)
assert.match(brain,/rc04TranslationCapabilityReply\(\{ prompt \}\)/)
assert.match(brain,/const grounded = translationCapability \|\|/)
assert.match(launcher,/ORBIA_LUMIA_TRANSLATE_ENABLED=1/)
assert.match(launcher,/ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED=1/)
assert.match(launcher,/ORBIA_LUMIA_RC04_CAPABILITIES=1/)

// Full adapter path: an already-authorized "what can you translate?" turn
// should produce exactly one spoken reply without a fabricated model/tool call.
const prev = {
  ORBIA_BRAIN_PROVIDER: process.env.ORBIA_BRAIN_PROVIDER,
  ORBIA_LUMIA_TRANSLATE_ENABLED: process.env.ORBIA_LUMIA_TRANSLATE_ENABLED,
  ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED: process.env.ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED,
  ORBIA_LUMIA_RC04_CAPABILITIES: process.env.ORBIA_LUMIA_RC04_CAPABILITIES,
}
Object.assign(process.env,{
  ORBIA_BRAIN_PROVIDER:'ollama',
  ORBIA_LUMIA_TRANSLATE_ENABLED:'1',
  ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED:'1',
  ORBIA_LUMIA_RC04_CAPABILITIES:'1',
})
const originalFetch = globalThis.fetch
let called = 0
globalThis.fetch = async () => { called++; throw new Error('No network call expected for RC-04') }
try {
  const { streamOllama } = await import('../bridge/ollama.mjs')
  const uttered = []
  const result = await streamOllama({
    prompt:query,history:[],systemPrompt:'LUMIA test.',knowledgeContext:null,
    toolContext:'',image:null,signal:new AbortController().signal,
    onText:(value)=>uttered.push(value),
  })
  assert.equal(result,answer)
  assert.deepEqual(uttered,[answer])
  assert.equal(called,0)
} finally {
  globalThis.fetch=originalFetch
  for (const [key,value] of Object.entries(prev)) {
    if (value===undefined) delete process.env[key]
    else process.env[key]=value
  }
}
console.log('LUMIA RC-04: actual translation module awareness and safe runtime gating PASS')
