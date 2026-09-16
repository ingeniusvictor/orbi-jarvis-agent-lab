import assert from 'node:assert/strict'
import {
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_ENTRIES,
  buildKnowledgeContext,
  knowledgeContextToPrompt,
  searchLocalKnowledge,
} from '../bridge/orbia/knowledge.mjs'

const identityMatches = searchLocalKnowledge('¿Quién es LUMIA?')
assert.ok(identityMatches.length >= 1)
assert.equal(identityMatches[0].entry.id, 'lumia-identity')

const studio = buildKnowledgeContext('¿Qué es LUMIA Studio y cómo se relaciona con ORBIA?')
assert.ok(studio.entries.length >= 1)
assert.ok(studio.entries.length <= MAX_CONTEXT_ENTRIES)
assert.ok(studio.totalCharacters <= MAX_CONTEXT_CHARACTERS)
assert.ok(studio.entries.some((entry) => entry.id === 'lumia-studio-mode'))
assert.match(knowledgeContextToPrompt(studio), /CONTEXTO ORBI CONTROLADO/)

const mppt = buildKnowledgeContext('¿Qué es un MPPT en paneles solares?')
assert.ok(mppt.entries.some((entry) => entry.id === 'solar-mppt-basics'))
assert.match(knowledgeContextToPrompt(mppt), /Maximum Power Point Tracking/)
assert.match(knowledgeContextToPrompt(mppt), /No es un protocolo de comunicaciones/)

const unknown = buildKnowledgeContext('ornitorrinco cuántico de marte')
assert.equal(unknown.entries.length, 0)

console.log('C1-C Knowledge Envelope smoke test: PASS')
console.log(`Bounded context: <= ${MAX_CONTEXT_ENTRIES} entries / <= ${MAX_CONTEXT_CHARACTERS} chars`)
console.log('Grounding: deterministic local-static provenance')
