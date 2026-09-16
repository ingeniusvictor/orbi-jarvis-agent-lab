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
  getVoiceRuntime: () => ({
    status: 'READY',
    requested: { sttMode: 'auto', ttsMode: 'auto', voiceProfile: 'lumia-system' },
    effective: { effectiveStt: 'browser', effectiveTts: 'system' },
  }),
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

const voiceRequest = selectReadOnlyTool(
  'Lumi, ¿qué modo de voz estás usando?',
  conversationId,
  'runtime-tool-voice',
)
assert.equal(voiceRequest?.name, 'orbi_voice_runtime_status')
const voiceExecution = await executor.execute(voiceRequest, { allowed })
assert.equal(voiceExecution.result.ok, true)
assert.match(voiceExecution.result.value, /effectiveStt/)

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
