import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isIncompleteLumiaSpelling,
  normalizeSpokenLumiaName,
} from '../src/lib/speech-pronunciation'

assert.equal(normalizeSpokenLumiaName('Soy L.U.M.I.A., tu asistente.'), 'Soy Lumia, tu asistente.')
assert.equal(normalizeSpokenLumiaName('Mi nombre es L. U. M. I. A. y puedes llamarme Lumi.'),
  'Mi nombre es Lumia y puedes llamarme Lumi.')
assert.equal(normalizeSpokenLumiaName('L.u.m.i.a. también se llama Lumi.'), 'Lumia también se llama Lumi.')
assert.equal(normalizeSpokenLumiaName('Soy LUMIA, tu asistente.'), 'Soy LUMIA, tu asistente.')
assert.equal(normalizeSpokenLumiaName('O.R.B.I.A. controla los módulos MPPT.'),
  'O.R.B.I.A. controla los módulos MPPT.')
assert.equal(normalizeSpokenLumiaName('La palabra L.U.M.I.A.N.A. no es un nombre.'),
  'La palabra L.U.M.I.A.N.A. no es un nombre.')
assert.equal(normalizeSpokenLumiaName('Para L.U.M.I.A. y L.U.M.I.A. es lo mismo.'),
  'Para Lumia y Lumia es lo mismo.')
assert.equal(normalizeSpokenLumiaName('L.U.M.I.A'), 'L.U.M.I.A',
  'Do not expand an unfinished or unpunctuated acronym arbitrarily.')

const dotted = 'Soy L. U. M. I. A. y puedo ayudarte hoy.'
for (let i = 0; i < dotted.length; i++) {
  const prefix = dotted.slice(0, i + 1)
  const rendered = normalizeSpokenLumiaName(prefix)
  if (prefix.endsWith('L. ') || prefix.endsWith('L. U. ') ||
      prefix.endsWith('L. U. M. ') || prefix.endsWith('L. U. M. I. ')) {
    assert.equal(isIncompleteLumiaSpelling(rendered), true)
  }
}
let buffered = ''
let spoken = ''
for (const delta of dotted) {
  buffered = normalizeSpokenLumiaName(buffered + delta)
  if (isIncompleteLumiaSpelling(buffered)) continue
  // Simulate the sentence-end flush without other TTS heuristics.
  const match = /([.!?]["'')\]”’]?\s)|(\n\n)/.exec(buffered)
  if (match) {
    const cut = match.index + match[0].length
    spoken += buffered.slice(0, cut)
    buffered = buffered.slice(cut)
  }
}
spoken += normalizeSpokenLumiaName(buffered)
assert.equal(spoken, 'Soy Lumia y puedo ayudarte hoy.',
  'Spelled dotted name must survive one-character streaming without letter-by-letter utterances.')

const tts = readFileSync(new URL('../src/lib/tts.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
assert.match(tts, /function shape\(text: string\): string \{\s*return \(\s*normalizeSpokenLumiaName\(text\)/)
assert.match(tts, /buffer = normalizeSpokenLumiaName\(buffer \+ delta\)/)
assert.match(tts, /if \(isIncompleteLumiaSpelling\(buffer\)\) return/)
assert.match(app, /'Hola\. Soy Lumia, la asistente/)
assert.match(avatar, /prepared\.faceOnly \? FACE_SCALE_EFFECTIVE : 1/)
console.log('LUMIA PRON-01 TTS-only name normalization and streamed dotted-intro safeguards: PASS')
console.log('Visible identity, other technical acronyms and canonical GLB left unchanged.')
