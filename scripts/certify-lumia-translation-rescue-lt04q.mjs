import assert from 'node:assert/strict'
import { translateLocalText, LocalTranslationError } from '../bridge/orbia/local-translate.mjs'
import { readFileSync } from 'node:fs'

const args={ollamaUrl:'http://127.0.0.1:11434',model:'qwen3.5:2b-q4_K_M'}
const original='ESA SEGUNDA TRADUCCIÓN NO SALIÓ EN INGLÉS'
const savedFetch=globalThis.fetch

try {
  let attempts=0
  const examples=[
    {translation:'This is the second translation attempt.'},
    {translation:'That second translation came out in English.'},
  ]
  globalThis.fetch=async (uri,opts)=>{
    attempts++
    assert.equal(uri,'http://127.0.0.1:11434/api/chat')
    const payload=JSON.parse(opts.body)
    assert.equal(payload.messages[1].content,original)
    assert.equal(payload.stream,false)
    assert.equal(payload.think,false)
    if(attempts<3){
      assert.deepEqual(payload.format.required,['translation'])
      return {ok:true,json:async()=>({message:{content:JSON.stringify(examples[attempts-1])}})}
    }
    assert.equal('format' in payload,false)
    assert.match(payload.messages[0].content,/Preserve negations/)
    return {ok:true,json:async()=>({message:{content:'That second translation did not come out in English.'}})}
  }
  const recovered=await translateLocalText({text:original,source:'es',target:'en'},args)
  assert.equal(recovered.translation,'That second translation did not come out in English.')
  assert.equal(attempts,3)

  attempts=0
  globalThis.fetch=async()=>{
    attempts++
    return {ok:true,json:async()=>({message:{content:JSON.stringify({
      translation:'That second translation did not come out in English.',
    })}})}
  }
  const fast=await translateLocalText({text:original,source:'es',target:'en'},args)
  assert.equal(fast.translation,'That second translation did not come out in English.')
  assert.equal(attempts,1)

  attempts=0
  globalThis.fetch=async()=>{
    attempts++
    return {ok:true,json:async()=>({message:{content:attempts===3
      ? 'This is the second translation attempt.'
      : JSON.stringify({translation:'This is the second translation attempt.'})}})}
  }
  await assert.rejects(
    ()=>translateLocalText({text:original,source:'es',target:'en'},args),
    e=>e instanceof LocalTranslationError &&
      e.code==='QUALITY_REJECTED' &&
      /falta una negación/.test(e.message))
  assert.equal(attempts,3)
} finally { globalThis.fetch=savedFetch }

const server=readFileSync(new URL('../bridge/server.mjs',import.meta.url),'utf8')
assert.match(server,/err\?\.code === 'QUALITY_REJECTED'/)
assert.match(server,/reply\(422/)
assert.match(server,/code: 'OLLAMA_TIMEOUT'/)
assert.match(server,/code: 'OLLAMA_FAILURE'/)
assert.doesNotMatch(server,/return reply\(502, \{ ok: false, error: 'No se pudo completar la traducción local\.' \}/)
console.log('LT-04Q third plain retry, fast correct first pass, specific private errors: PASS')
