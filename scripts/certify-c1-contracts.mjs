import assert from 'node:assert/strict'
import {
  createConversationTurn,
  createKnowledgeContext,
  createToolRequest,
  createToolResult,
  createPermissionDecision,
  createRuntimeState,
} from '../bridge/orbia/contracts.mjs'
import {
  LUMIA_IDENTITY,
  composeLumiaVoiceSystemPrompt,
} from '../bridge/orbia/lumia-identity.mjs'
import {
  appendConversationExchange,
  clearConversation,
  getConversationHistory,
} from '../bridge/orbia/conversation.mjs'

const conversationId = 'c1-smoke-conversation'

const turn = createConversationTurn({
  id: 'turn-1',
  conversationId,
  role: 'user',
  content: 'Hola Lumi',
})
assert.equal(turn.role, 'user')
assert.equal(turn.conversationId, conversationId)

const knowledge = createKnowledgeContext({
  query: 'ORBI',
  entries: [
    {
      id: 'orbi-1',
      domain: 'orbi',
      title: 'ORBI Ecosystem',
      content: 'Contexto sintético de certificación.',
      score: 1,
    },
  ],
})
assert.equal(knowledge.matchCount, 1)
assert.equal(knowledge.entries[0].id, 'orbi-1')

const request = createToolRequest({
  id: 'tool-1',
  conversationId,
  name: 'orbi_runtime_status',
  input: {},
})
assert.equal(request.name, 'orbi_runtime_status')

const result = createToolResult({
  requestId: request.id,
  name: request.name,
  ok: true,
  value: 'ready',
  durationMs: 4,
})
assert.equal(result.ok, true)

const permission = createPermissionDecision({
  toolName: request.name,
  allowed: true,
  reason: 'read-only diagnostic',
})
assert.equal(permission.allowed, true)

const runtime = createRuntimeState({
  conversationId,
  provider: 'ollama',
  model: 'orbia-lumia:4b',
  phase: 'thinking',
})
assert.equal(runtime.provider, 'ollama')

const prompt = composeLumiaVoiceSystemPrompt({
  toolsEnabled: false,
  knowledgeEnabled: false,
})
assert.match(prompt, /L\.U\.M\.I\.A\./)
assert.match(prompt, /O\.R\.B\.I\.A\./)
assert.match(prompt, /herramientas todavía no están habilitadas/i)
assert.equal(LUMIA_IDENTITY.spokenName, 'Lumi')

clearConversation(conversationId)
assert.equal(getConversationHistory(conversationId).length, 0)
appendConversationExchange(conversationId, 'Primera pregunta', 'Primera respuesta')
appendConversationExchange(conversationId, 'Segunda pregunta', 'Segunda respuesta')
const history = getConversationHistory(conversationId)
assert.equal(history.length, 4)
assert.deepEqual(
  history.map((item) => item.role),
  ['user', 'assistant', 'user', 'assistant'],
)
clearConversation(conversationId)

console.log('C1 canonical contract smoke test: PASS')
console.log('Identity: L.U.M.I.A. / O.R.B.I.A. canonical projection')
console.log('Conversation: stable id + ephemeral process-local history')
console.log('Knowledge/tool/permission/runtime contracts: structurally valid')
