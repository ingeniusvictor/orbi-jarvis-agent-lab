import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { translateLocalText, validateTranslation, TRANSLATION_LANGUAGES } from '../bridge/orbia/local-translate.mjs'
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
assert.deepEqual(TRANSLATION_LANGUAGES, ['es', 'en', 'zh'])
assert.deepEqual(validateTranslation({ text:'  你好，工程师！ ', source:'zh', target:'es' }),
  {text:'你好，工程师！',source:'zh',target:'es'})
assert.throws(() => validateTranslation({text:'x', source:'es', target:'es'}), /diferentes/)
assert.throws(() => validateTranslation({text:'x', source:'auto', target:'es'}), /diferentes/)
assert.throws(() => validateTranslation({text:' ', source:'en', target:'es'}), /4000/)
assert.throws(() => validateTranslation({text:'x'.repeat(4001), source:'en', target:'es'}), /4000/)
assert.throws(() => validateTranslation({text:'abc\u0001', source:'en', target:'es'}), /4000/)
await assert.rejects(() => translateLocalText({text:'hi',source:'en',target:'es'},
  {ollamaUrl:'https://api.example.com',model:'qwen'}), /Ollama local/)
const savedFetch = globalThis.fetch
try {
  let called = 0
  globalThis.fetch = async (url, options) => {
    called += 1
    assert.equal(url, 'http://127.0.0.1:11434/api/chat')
    const payload = JSON.parse(options.body)
    assert.equal(payload.model, 'qwen3.5:2b-q4_K_M')
    assert.equal(payload.think, false)
    assert.equal(payload.stream, false)
    assert.equal(payload.messages.length, 2)
    assert.match(payload.messages[0].content, /BESS, BMS, EMS, PCS, SOC y SOH/)
    assert.equal(payload.messages[1].content, '你好')
    return { ok:true, json:async()=>({message:{content:JSON.stringify({translation:'Hola'})}}) }
  }
  const result = await translateLocalText({text:'你好',source:'zh',target:'es'},
    {ollamaUrl:'http://127.0.0.1:11434',model:'qwen3.5:2b-q4_K_M'})
  assert.equal(result.translation, 'Hola')
  assert.equal(called, 1)
} finally {
  globalThis.fetch = savedFetch
}
const frontend = read('src/ui/LumiaComposer.tsx')
const app = read('src/App.tsx')
const server = read('bridge/server.mjs')
const client = read('src/lib/translate.ts')
const launcher = read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(frontend, /aria-label={translateEnabled \? 'Desactivar LUMIA Translate'/)
assert.match(frontend, /aria-pressed={translateEnabled}/)
assert.match(frontend, /onModeChange\('text'\)/)
assert.match(frontend, /TRADUCCIÓN LOCAL · TEXTO/)
assert.match(frontend, /aria-label="Idioma de origen"/)
assert.match(frontend, /aria-label="Idioma de destino"/)
assert.match(frontend, /disabled={busy \|\| preparing \|\| translateEnabled}/)
assert.match(app, /onTranslate={translateWritten}/)
assert.match(app, /translateLocalText\(text, source, target\)/)
assert.match(app, /s\.pushTurn\(/)
assert.match(client, /BRIDGE_HTTP_URL \+ '\/translate\/local'/)
assert.match(server, /ORBIA_LUMIA_TRANSLATE_ENABLED !== '1'/)
assert.match(server, /PROVIDER !== 'ollama'/)
assert.match(server, /req\.url === '\/translate\/local'/)
assert.match(server, /AbortSignal\.timeout\(45_000\)/)
assert.match(launcher, /set "VITE_LUMIA_TRANSLATE_LT01=1"/)
assert.match(launcher, /set "ORBIA_LUMIA_TRANSLATE_ENABLED=1"/)
assert.match(read('bridge/orbia/local-stt.mjs'), /'-l',[\s\S]*?'es'|'es',/)
console.log('LUMIA LT-01: isolated local text translation; manual languages; no continuous multilingual STT PASS')
