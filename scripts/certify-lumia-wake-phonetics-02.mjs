import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const code = readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8')
const extract = (name) => {
  const start = code.indexOf('const ' + name + ' =')
  assert.ok(start >= 0, name + ' exists')
  const line = code.slice(start).split('\n')[1].trim()
  assert.match(line, /^\/.*\/i$/)
  return new RegExp(line.slice(1, -2), 'i')
}
const wake = extract('WAKE')
const bare = extract('BARE_WAKE')
for (const said of [
  'Hola lumi como estás',
  'lo mí tienes forma de saber el clima como estará mañana',
  'Lo mí, por vos te pregunté varias cosas y no me respondiste',
  'lo mi puedes ayudarme a aprender IA local',
]) assert.equal(wake.test(said), true, said)
for (const said of ['por lo mi corazón', 'quiero lo mío', 'mañana por lo mi', 'lo mismo de ayer']) {
  assert.equal(wake.test(said), false, said)
}
assert.equal(bare.test('Lo mí'), true)
assert.equal(bare.test('Lo mí, ¿cómo estás?'), false)
assert.equal(bare.test('hola lumi'), true)
assert.equal(wake.test('¿Tua la lunda y cómo estás?'), false, 'garbled phrase must not be assumed authorized')
console.log('LUMIA WAKE-02: address-only Whisper phonetics recognized, unrelated speech remains gated PASS')
