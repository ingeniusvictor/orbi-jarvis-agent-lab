import assert from 'node:assert/strict'
import { checkTranslationQuality, translateLocalText } from '../bridge/orbia/local-translate.mjs'

const args = { ollamaUrl:'http://127.0.0.1:11434', model:'qwen3.5:2b-q4_K_M' }
assert.equal(checkTranslationQuality('¿Puedes hacer la traducción en voz?',
  '¿Puedes hacer la traducción en voz?', 'es','en'), 'unchanged-source')
assert.equal(checkTranslationQuality('¿Puedes hacer la traducción en voz?',
  'Quiero que hagas la traducción en voz', 'es','en'), 'spanish-remains')
assert.equal(checkTranslationQuality('ESA SEGUNDA TRADUCCION NO SALIO EN INGLES',
  'The second translation by ESA did not come out in English.', 'es','en'),
  'untranslated-demonstrative')
assert.equal(checkTranslationQuality('¿Puedes hacer la traducción en voz?',
  'Can you translate it out loud?', 'es','en'), null)
assert.equal(checkTranslationQuality('ESA SEGUNDA TRADUCCION NO SALIO EN INGLES',
  'That second translation did not come out in English.', 'es','en'), null)
assert.equal(checkTranslationQuality('La ESA trabaja con satélites',
  'The ESA works with satellites.', 'es','en'), null)
assert.equal(checkTranslationQuality('Hola', 'Hello', 'es','en'), null)
assert.equal(checkTranslationQuality('Hola', 'Hola', 'es','en'), 'unchanged-source')
assert.equal(checkTranslationQuality('Hello world', 'Hello world', 'en','es'), 'unchanged-source')
assert.equal(checkTranslationQuality('Can you translate this text?',
  'Can you translate this text?', 'en','es'), 'unchanged-source')
assert.equal(checkTranslationQuality('Can you translate this text?',
  '¿Puedes traducir este texto?', 'en','es'), null)
assert.equal(checkTranslationQuality('Hola, ¿cómo estás?', 'Hello, how are you?', 'es','en'), null)
assert.equal(checkTranslationQuality('Hola', 'Hello', 'es','zh'), 'missing-mandarin-script')
assert.equal(checkTranslationQuality('Hola', '你好', 'es','zh'), null)
assert.equal(checkTranslationQuality('你好，工程师', 'Hello, engineer', 'zh','en'), null)
assert.equal(checkTranslationQuality('你好，工程师', '你好，工程师', 'zh','en'), 'unchanged-source')
assert.equal(checkTranslationQuality('El BESS opera con SOC 80%',
  'The BESS operates at SOC 80%.', 'es','en'), null)

const original = globalThis.fetch
try {
  let calls = 0
  const outputs = [
    '¿Puedes hacer la traducción en voz?',
    'Can you translate it out loud?',
  ]
  globalThis.fetch = async (_url, options) => {
    calls++
    const payload = JSON.parse(options.body)
    assert.equal(payload.messages[1].content, '¿Puedes hacer la traducción en voz?')
    assert.equal(payload.stream, false)
    assert.equal(payload.think, false)
    if (calls === 2) assert.match(payload.messages[0].content, /ADVERTENCIA DE CALIDAD/)
    return {ok:true,json:async()=>({message:{content:JSON.stringify({translation:outputs[calls-1]})}})}
  }
  const result = await translateLocalText(
    {text:'¿Puedes hacer la traducción en voz?',source:'es',target:'en'},args)
  assert.equal(result.translation,'Can you translate it out loud?')
  assert.equal(calls,2)

  calls = 0
  globalThis.fetch = async () => {
    calls++
    return {ok:true,json:async()=>({message:{content:JSON.stringify({
      translation:'¿Puedes hacer la traducción en voz?',
    })}})}
  }
  await assert.rejects(()=>translateLocalText(
    {text:'¿Puedes hacer la traducción en voz?',source:'es',target:'en'},args),
  /No mostraré como válida una traducción sin verificar/)
  assert.equal(calls,2)

  calls = 0
  globalThis.fetch = async () => {
    calls++
    return {ok:true,json:async()=>({message:{content:JSON.stringify({
      translation:'The second translation did not come out in English.',
    })}})}
  }
  const good = await translateLocalText(
    {text:'ESA SEGUNDA TRADUCCION NO SALIO EN INGLES',source:'es',target:'en'},args)
  assert.equal(good.translation,'The second translation did not come out in English.')
  assert.equal(calls,1) // valid translations retain low first-response latency
} finally { globalThis.fetch = original }

console.log('LUMIA LT-02Q: echoed Spanish, mixed ESA, Mandarin script, 1 bounded retry, valid fast path PASS')
