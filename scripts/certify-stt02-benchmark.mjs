import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stt02Words,wordErrorRate } from '../bridge/orbia/stt02-accuracy.mjs'
assert.deepEqual(stt02Words('¿Cómo preparar una Arépa, Venezolana?'),
  ['como','preparar','una','arepa','venezolana'])
assert.equal(wordErrorRate('¿Cómo preparar una arepa?', 'como preparar una arepa').wer,0)
assert.equal(wordErrorRate('hacer una arepa','hacer una arriba').errors,1)
assert.equal(wordErrorRate('hola lumi como estas','hola').errors,3)
assert.equal(wordErrorRate('hola','hola hola').errors,1)
assert.throws(()=>wordErrorRate('','hola'),/referencia/)
const script=readFileSync(new URL('./benchmark-stt02.mjs',import.meta.url),'utf8')
for(const label of ['ggml-small.bin','ggml-base.bin','--moonshine-file','wordErrorRate','90000']) {
  assert.ok(script.includes(label),label)
}
assert.doesNotMatch(script,/fetch\s*\(\s*['"]https:|https\.request\s*\(/)
console.log('LUMIA STT-02: offline WER metrics, 3 candidate inputs, no model switch PASS')
