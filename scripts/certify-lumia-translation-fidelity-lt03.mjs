import assert from 'node:assert/strict'
import { checkTranslationQuality, translateLocalText } from '../bridge/orbia/local-translate.mjs'
const sentence = 'ESA SEGUNDA TRADUCCIÓN NO SALIÓ EN INGLÉS'
assert.equal(checkTranslationQuality(sentence,
  'This is the second translation attempt.', 'es','en'), 'missing-negation')
assert.equal(checkTranslationQuality(sentence,
  'That second translation did not come out.', 'es','en'),'missing-named-language')
assert.equal(checkTranslationQuality(sentence,
  'The translation did not come out in English.', 'es','en'),'missing-ordinal')
assert.equal(checkTranslationQuality(sentence,
  'The second translation did not come out in English.', 'es','en'),null)
assert.equal(checkTranslationQuality('El inversor no está disponible',
  'The inverter is not available.','es','en'),null)
assert.equal(checkTranslationQuality('The inverter is not available',
  'El inversor está disponible.','en','es'),'missing-negation')
assert.equal(checkTranslationQuality('The inverter is not available',
  'El inversor no está disponible.','en','es'),null)
assert.equal(checkTranslationQuality('El BESS tiene 25 módulos SOC 80%',
  'The BESS has 24 modules SOC 80%.','es','en'),'missing-number')
assert.equal(checkTranslationQuality('El BESS opera con SOC',
  'The system operates with SOC.','es','en'),'missing-technical-acronym')
assert.equal(checkTranslationQuality('El BESS opera con SOC',
  'The BESS operates with SOC.','es','en'),null)
assert.equal(checkTranslationQuality('你好','Hello','zh','en'),null)
const originalFetch=globalThis.fetch
try {
  let attempts=0
  globalThis.fetch=async (_url, options)=>{
    const packet=JSON.parse(options.body)
    assert.equal(packet.messages[1].content,sentence)
    attempts++
    return {ok:true,json:async()=>({message:{content:JSON.stringify({
      translation:attempts===1
        ? 'This is the second translation attempt.'
        : 'That second translation did not come out in English.',
    })}})}
  }
  const result=await translateLocalText(
    {text:sentence,source:'es',target:'en'},
    {ollamaUrl:'http://127.0.0.1:11434',model:'qwen3.5:2b-q4_K_M'})
  assert.equal(result.translation,'That second translation did not come out in English.')
  assert.equal(attempts,2)
  attempts=0
  globalThis.fetch=async () => {
    attempts++
    return {ok:true,json:async()=>({message:{content:JSON.stringify({
      translation:'This is the second translation attempt.',
    })}})}
  }
  await assert.rejects(()=>translateLocalText(
    {text:sentence,source:'es',target:'en'},
    {ollamaUrl:'http://127.0.0.1:11434',model:'qwen3.5:2b-q4_K_M'}),
  /no se pudo validar la traducción/)
  assert.equal(attempts,3)
} finally {
  globalThis.fetch=originalFetch
}
console.log('LUMIA LT-03: negation, named languages, ordinal, numeric and BESS fidelity with bounded retry PASS')
