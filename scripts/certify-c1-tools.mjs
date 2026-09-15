import assert from 'node:assert/strict'
import { createToolRequest } from '../bridge/orbia/contracts.mjs'
import { ToolExecutor, ToolRegistry } from '../bridge/orbia/tool-engine.mjs'
import { createReadOnlyDiagnosticTools } from '../bridge/orbia/diagnostic-tools.mjs'
import {
  appendConversationExchange,
  clearConversation,
} from '../bridge/orbia/conversation.mjs'

const conversationId = 'c1-d-tool-smoke'
clearConversation(conversationId)
appendConversationExchange(conversationId, 'Hola', 'Hola. Soy Lumi.')

const registry = new ToolRegistry()
for (const tool of createReadOnlyDiagnosticTools({
  provider: 'ollama',
  model: 'orbia-lumia:4b',
})) {
  registry.register(tool)
}

assert.deepEqual(
  registry.list().map((tool) => tool.name),
  ['orbi_runtime_status', 'orbi_knowledge_search', 'orbi_conversation_status'],
)

const executor = new ToolExecutor(registry)
const allowed = registry.list().map((tool) => tool.name)

const runtimeRequest = createToolRequest({
  id: 'tool-1',
  conversationId,
  name: 'orbi_runtime_status',
  input: {},
})
const runtime = await executor.execute(runtimeRequest, { allowed })
assert.equal(runtime.permission.allowed, true)
assert.equal(runtime.result.ok, true)
assert.match(runtime.result.value, /C1_READ_ONLY/)

const knowledgeRequest = createToolRequest({
  id: 'tool-2',
  conversationId,
  name: 'orbi_knowledge_search',
  input: { query: 'LUMIA Studio ORBIA' },
})
const knowledge = await executor.execute(knowledgeRequest, { allowed })
assert.equal(knowledge.result.ok, true)
assert.match(knowledge.result.value, /lumia-studio-mode/)

const conversationRequest = createToolRequest({
  id: 'tool-3',
  conversationId,
  name: 'orbi_conversation_status',
  input: {},
})
const conversation = await executor.execute(conversationRequest, { allowed })
assert.equal(conversation.result.ok, true)
assert.match(conversation.result.value, /"messageCount":2/)

const denied = await executor.execute(runtimeRequest, { allowed: [] })
assert.equal(denied.permission.allowed, false)
assert.equal(denied.result.errorCode, 'TOOL_DENIED')

const invalid = await executor.execute(
  createToolRequest({
    id: 'tool-4',
    conversationId,
    name: 'orbi_knowledge_search',
    input: {},
  }),
  { allowed },
)
assert.equal(invalid.result.errorCode, 'TOOL_INVALID_INPUT')

clearConversation(conversationId)

console.log('C1-D Tool Engine smoke test: PASS')
console.log('Registry/executor: deterministic and bounded')
console.log('Permissions: explicit allowlist')
console.log('Initial tools: 3 read-only diagnostics')
