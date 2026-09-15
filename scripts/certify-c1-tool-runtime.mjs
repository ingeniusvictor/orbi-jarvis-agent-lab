import assert from 'node:assert/strict'
import {
  selectReadOnlyTool,
  toolResultToPrompt,
} from '../bridge/ollama.mjs'
import { createReadOnlyDiagnosticTools } from '../bridge/orbia/diagnostic-tools.mjs'
import { ToolExecutor, ToolRegistry } from '../bridge/orbia/tool-engine.mjs'

const conversationId = 'c1-d-runtime-cert'
const registry = new ToolRegistry()
for (const tool of createReadOnlyDiagnosticTools({
  provider: 'ollama',
  model: 'orbia-lumia:4b',
})) {
  registry.register(tool)
}
const executor = new ToolExecutor(registry)
const allowed = registry.list().map((tool) => tool.name)

const runtimeRequest = selectReadOnlyTool(
  'Lumi, ¿qué modelo estás usando?',
  conversationId,
  'runtime-tool-1',
)
assert.equal(runtimeRequest?.name, 'orbi_runtime_status')

const runtimeExecution = await executor.execute(runtimeRequest, { allowed })
assert.equal(runtimeExecution.result.ok, true)
assert.match(runtimeExecution.result.value, /orbia-lumia:4b/)
assert.match(toolResultToPrompt(runtimeExecution), /SOLO LECTURA/)

const conversationRequest = selectReadOnlyTool(
  '¿Cuántos mensajes llevamos?',
  conversationId,
  'runtime-tool-2',
)
assert.equal(conversationRequest?.name, 'orbi_conversation_status')

const knowledgeRequest = selectReadOnlyTool(
  'Busca en el conocimiento LUMIA Studio',
  conversationId,
  'runtime-tool-3',
)
assert.equal(knowledgeRequest?.name, 'orbi_knowledge_search')
assert.equal(knowledgeRequest?.input.query, 'LUMIA Studio')

const ordinary = selectReadOnlyTool(
  'Explícame qué es un inversor fotovoltaico',
  conversationId,
  'runtime-tool-4',
)
assert.equal(ordinary, null)

console.log('C1-D runtime Tool/HUD contract smoke test: PASS')
console.log('Routing: explicit read-only intents only')
console.log('Tool result prompt: bounded and structured')
console.log('Ordinary conversation: no diagnostic tool route')
