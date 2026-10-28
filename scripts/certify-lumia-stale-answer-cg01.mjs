import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isStaleModelReply } from '../bridge/orbia/stale-answer-guard.mjs'

const oldAnswer = 'Entendido. No necesito un resumen; solo quiero saber cuántos segundos puedo capturar antes de cortar la conversación. ¿Tienes acceso a los detalles técnicos de tu sistema local?'
const sameWrongReply = 'Entendido, no necesito un resumen; solo quiero saber cuántos segundos puedo capturar antes de cortar la conversación. ¿Tienes acceso a los detalles técnicos de tu sistema local?'
const history = [
  { role: 'user', content: 'Tú ni se te pido hacer un resumen.' },
  { role: 'assistant', content: oldAnswer },
]
assert.equal(isStaleModelReply({
  history, prompt: 'No lo que te estoy pidiendo es si te doy un informe. ¿Puedes hacer un resumen del informe?', answer: sameWrongReply,
}), true, 'Replay shown in 16:43:19 conversation log must be detected.')
assert.equal(isStaleModelReply({
  history, prompt: 'Si te llamo por otro nombre no me contestas.', answer: sameWrongReply,
}), true, 'Repeated wrong answer at 16:45:10 must be detected.')
assert.equal(isStaleModelReply({
  history, prompt: 'Tú ni se te pido hacer un resumen.', answer: oldAnswer,
}), false, 'Do not block an intentionally repeated question.')
assert.equal(isStaleModelReply({
  history, prompt: 'Repite lo anterior por favor.', answer: oldAnswer,
}), false, 'Owner can request a repeat.')
assert.equal(isStaleModelReply({
  history, prompt: 'Si te llamo por otro nombre no me contestas.', answer: 'Sí, contesto si usas Lumi.',
}), false, 'Short replies and new content must not be rejected.')
assert.equal(isStaleModelReply({
  history: [], prompt: '¿Puedes hacer un resumen?', answer: oldAnswer,
}), false, 'No prior reply is no replay.')
const brain = readFileSync(new URL('../bridge/ollama.mjs', import.meta.url), 'utf8')
assert.match(brain, /isStaleModelReply\(\{ answer: text, prompt, history \}\)/)
assert.match(brain, /await runStructured\(correctionMessages\)/)
assert.match(brain, /if \(signal\?\.aborted\) throw error/)
assert.match(brain, /No conseguí responder correctamente a tu última pregunta/)
console.log('LUMIA CG-01: repeated long answer detected and one bounded local retry wired: PASS')
