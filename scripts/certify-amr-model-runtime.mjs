import assert from 'node:assert/strict'
import {
  buildModelInventory,
  getActiveModel,
  parseModelControl,
  resolveModelRequest,
  setActiveModel,
} from '../bridge/orbia/model-manager.mjs'
import { createReadOnlyDiagnosticTools } from '../bridge/orbia/diagnostic-tools.mjs'
import { ToolExecutor, ToolRegistry } from '../bridge/orbia/tool-engine.mjs'

const installed = [
  'orbia-lumia:4b',
  'qwen3:1.7b',
  'qwen3:4b',
  'qwen2.5-coder:7b',
]

assert.equal(
  resolveModelRequest('rápido', installed),
  'qwen3:1.7b',
)
assert.equal(
  resolveModelRequest('modelo equilibrado', installed),
  'orbia-lumia:4b',
)
assert.equal(
  resolveModelRequest('modelo de código', installed),
  'qwen2.5-coder:7b',
)

assert.equal(
  resolveModelRequest('qwen3 4b', installed),
  'qwen3:4b',
)
assert.equal(
  resolveModelRequest('qeen 4b', installed),
  'orbia-lumia:4b',
)
assert.equal(
  resolveModelRequest('queen 3 4 b', installed),
  'qwen3:4b',
)
assert.equal(
  resolveModelRequest('qwen 4b', installed),
  'orbia-lumia:4b',
)
assert.equal(
  resolveModelRequest('orbi qwen 4b', installed),
  'orbia-lumia:4b',
)
assert.equal(
  resolveModelRequest('qwen3 4b original', installed),
  'qwen3:4b',
)
assert.equal(
  resolveModelRequest('qwin 1.7 b', installed),
  'qwen3:1.7b',
)

assert.deepEqual(
  parseModelControl('Lumi, ¿qué modelos puedo usar?'),
  { action: 'list' },
)

assert.deepEqual(
  parseModelControl('Lumi, cambia al modelo rápido'),
  { action: 'switch', requested: 'rápido' },
)

assert.deepEqual(
  parseModelControl('Lumi, ¿qué modelo puedes usar?'),
  { action: 'list' },
)

assert.deepEqual(
  parseModelControl('Lumi, puedes cambiar a 1.7b'),
  { action: 'switch', requested: '1.7b' },
)

assert.deepEqual(
  parseModelControl('Lumi, cámbiate a qwen3:4b'),
  { action: 'switch', requested: 'qwen3:4b' },
)

assert.deepEqual(
  parseModelControl('Lumi, puedes cambiar de modelo al 7b'),
  { action: 'switch', requested: '7b' },
)

assert.deepEqual(
  parseModelControl('Lumi, quiero cambiar de modelo a qeen 7 b'),
  { action: 'switch', requested: 'qeen 7 b' },
)

assert.deepEqual(
  parseModelControl('Lumi, puedes cambiar de modelo?'),
  { action: 'list' },
)

assert.equal(
  parseModelControl('Lumi, no quiero cambiar de modelo'),
  null,
)



const before = getActiveModel()
setActiveModel('qwen3:1.7b')

const registry = new ToolRegistry()
for (const tool of createReadOnlyDiagnosticTools({
  provider: 'ollama',
  getModel: getActiveModel,
})) {
  registry.register(tool)
}

const executor = new ToolExecutor(registry)
const execution = await executor.execute(
  {
    id: 'amr-status',
    conversationId: 'amr-cert',
    name: 'orbi_runtime_status',
    input: {},
  },
  { allowed: ['orbi_runtime_status'] },
)

assert.equal(execution.result.ok, true)
assert.match(execution.result.value, /qwen3:1.7b/)

const inventory = buildModelInventory(installed)
assert.equal(
  inventory.find((item) => item.name === 'qwen3:1.7b')?.active,
  true,
)

setActiveModel(before)

console.log('AMR-01 Adaptive Model Runtime smoke test: PASS')
console.log('Aliases: fast / balanced / coding')
console.log('Runtime status: active model is dynamic')
console.log('Voice control parser: list + switch intents')
