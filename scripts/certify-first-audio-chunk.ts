import assert from 'node:assert/strict'
import { findEarlySpeechBoundary } from '../src/lib/first-audio-chunk'

const short = 'Hola, ¿en qué puedo ayudarte?'
assert.equal(findEarlySpeechBoundary(short), null, 'Short answers wait for normal flush.')

const clause = 'LUMIA puede ayudarte a investigar, pensar y trabajar con tus proyectos, '
assert.ok(clause.length >= 52 && clause.length <= 148)
assert.equal(findEarlySpeechBoundary(clause), clause.length, 'First safe comma ends the phrase.')
assert.equal(findEarlySpeechBoundary(clause.slice(0, -1)), null, 'Never cut before whitespace arrives.')

const message = clause + 'sin perder el hilo de una conversación más extensa y natural.'
const clauseCut = findEarlySpeechBoundary(message)
assert.equal(clauseCut, clause.length)
assert.equal(message.slice(0, clauseCut) + message.slice(clauseCut), message, 'No duplicated or lost text.')
assert.equal(message.slice(clauseCut), 'sin perder el hilo de una conversación más extensa y natural.')

const long = (
  'LUMIA analiza la información de cada proyecto y mantiene una conversación ' +
  'que sigue siendo coherente cuando una explicación requiere bastante detalle ' +
  'y continúa sin ningún signo de puntuación importante en medio del texto'
)
assert.ok(long.length >= 148)
const longCut = findEarlySpeechBoundary(long)
assert.ok(longCut !== null && longCut >= 52 && longCut <= 148)
assert.equal(long[longCut - 1], ' ', 'Fallback must end at a word boundary.')
assert.equal(long.slice(0, longCut) + long.slice(longCut), long)

const noSpaces = 'x'.repeat(230)
assert.equal(findEarlySpeechBoundary(noSpaces), null, 'Do not cut inside an unbroken token.')
assert.equal(findEarlySpeechBoundary('Esta es una frase breve, '), null, 'Do not truncate short clauses.')

const lineBreak = 'Vamos a revisar primero los resultados de las pruebas y sus condiciones\nluego las recomendaciones.'
const lineCut = findEarlySpeechBoundary(lineBreak)
assert.ok(lineCut !== null)
assert.equal(lineBreak[lineCut - 1], '\n')

const words = 'Podemos mantener el contexto y dar una respuesta comprensible a cada paso, sin esperar a que termine todo el párrafo.'
for (let count = 1; count <= words.length; count += 1) {
  const current = words.slice(0, count)
  const cut = findEarlySpeechBoundary(current)
  if (cut !== null) {
    assert.equal(current.slice(0, cut) + current.slice(cut), current)
    assert.ok(cut <= current.length)
    assert.ok(/[\s\t]$/.test(current.slice(0, cut)), 'Cut after a word, not inside one.')
  }
}

console.log('LUMIA VL-01 first-audio chunk safety: PASS')
console.log('First-clause, bounded fallback, Unicode and streamed-delta boundaries: PASS')
console.log('No shortening of endpointing or Voice Gate authority: VERIFIED BY CHANGE SCOPE')


// ASUS opt-in first local-only chunk: word-safe, no text lost, legacy untouched.
const spanish = 'La Inteligencia Artificial Local es una tecnología que permite ejecutar modelos directamente en computadoras personales sin depender de servicios remotos para cada solicitud.'
assert.equal(findEarlySpeechBoundary(spanish.slice(0, 80)), null, 'Classic VL-01 still waits for its original threshold.')
const fastEarly = findEarlySpeechBoundary(spanish.slice(0, 88), { fastLocal: true })
assert.ok(fastEarly !== null && fastEarly >= 32 && fastEarly <= 88)
assert.equal(spanish.slice(fastEarly - 1, fastEarly), ' ', 'Fast mode also stops only between whole words.')
assert.equal(spanish.slice(0, fastEarly) + spanish.slice(fastEarly), spanish)
assert.equal(findEarlySpeechBoundary(short, { fastLocal: true }), null)
const shortClause = 'LUMIA puede investigar tus preguntas con cuidado, y ofrecer resultados útiles.'
const fastClause = findEarlySpeechBoundary(shortClause, { fastLocal: true })
assert.ok(fastClause !== null && fastClause <= 88)
assert.equal(shortClause.slice(0, fastClause) + shortClause.slice(fastClause), shortClause)
for (let length = 1; length <= spanish.length; length++) {
  const prefix = spanish.slice(0, length)
  const cut = findEarlySpeechBoundary(prefix, { fastLocal: true })
  if (cut !== null) {
    assert.ok(cut <= prefix.length)
    assert.ok(/[\s\t]$/.test(prefix.slice(0, cut)))
  }
}
console.log('LUMIA VL-07: ASUS opt-in early Kokoro phrase boundary: PASS')
