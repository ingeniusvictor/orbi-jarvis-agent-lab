import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isSubstantiveQuestion, isGenericReplyForQuestion, safeClarificationForQuestion,
} from '../bridge/orbia/response-relevance-rc02.mjs'

const stock='Estoy aquí para ayudarte a organizar tus ideas y tomar decisiones más claras en ORBI. ¿Qué necesitas resolver hoy?'
assert.equal(isSubstantiveQuestion('¿Cómo estás?'),true)
assert.equal(isGenericReplyForQuestion({prompt:'Hola Lumi',answer:stock}),false)
assert.equal(isGenericReplyForQuestion({prompt:'¿Qué capacidades tienes actualmente para resolver problemas?',answer:stock}),true)
assert.equal(isGenericReplyForQuestion({prompt:'¿Cómo puedo hacer una arepa venezolana?',answer:stock}),true)
assert.equal(isGenericReplyForQuestion({prompt:'¿Cómo puedo hacer una arepa venezolana?',answer:'Mezcla harina de maíz precocida con agua y sal; forma discos y cocina a la plancha.'}),false)
assert.match(safeClarificationForQuestion('Quiero IA local y una arepa venezolana'),/IA local y una receta de arepas venezolanas/)
assert.match(safeClarificationForQuestion('¿Qué capacidades tienes?'),/modelos locales instalados/)
const source=readFileSync(new URL('../bridge/ollama.mjs',import.meta.url),'utf8')
assert.match(source,/isGenericReplyForQuestion\(\{ answer: text, prompt \}\)/)
assert.match(source,/isGenericReplyForQuestion\(\{ answer: retryText, prompt \}\)/)
assert.match(source,/safeClarificationForQuestion\(prompt\)/)
console.log('LUMIA RC-02: generic answer guard and bounded safe clarification PASS')
