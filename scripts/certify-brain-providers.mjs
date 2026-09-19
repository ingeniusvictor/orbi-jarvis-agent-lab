import assert from 'node:assert/strict'
import {
  brainProviderStatus,
  listBrainProviders,
  normalizeBrainProvider,
  resolveBrainProvider,
} from '../bridge/providers/registry.mjs'
import {
  openAIConfigured,
  openAIConfigurationSource,
  OPENAI_MODEL,
} from '../bridge/providers/openai.mjs'

assert.equal(normalizeBrainProvider('local'), 'ollama')
assert.equal(normalizeBrainProvider('qwen'), 'ollama')
assert.equal(normalizeBrainProvider('gpt'), 'openai')
assert.equal(normalizeBrainProvider('chatgpt'), 'openai')
assert.equal(normalizeBrainProvider('hybrid'), 'hybrid')
assert.equal(normalizeBrainProvider('hibrido'), 'hybrid')
assert.equal(normalizeBrainProvider('anthropic'), 'claude')

assert.equal(
  resolveBrainProvider({ ORBIA_BRAIN_PROVIDER: 'openai' }).id,
  'openai',
)
assert.equal(
  resolveBrainProvider({ ORBIA_BRAIN_PROVIDER: 'hybrid' }).id,
  'hybrid',
)
assert.equal(
  resolveBrainProvider({ JARVIS_PROVIDER: 'ollama' }).id,
  'ollama',
)

assert.throws(
  () => resolveBrainProvider({ ORBIA_BRAIN_PROVIDER: 'unknown-provider' }),
  /Unsupported brain provider/,
)

const providers = listBrainProviders()
assert.deepEqual(
  providers.map((provider) => provider.id),
  ['ollama', 'openai', 'hybrid', 'claude'],
)

assert.equal(openAIConfigured({}), false)
assert.equal(
  openAIConfigured({ OPENAI_API_KEY: 'test-key' }),
  true,
)
assert.ok(OPENAI_MODEL)
assert.equal(openAIConfigurationSource({}), 'missing')
assert.equal(
  openAIConfigurationSource({ OPENAI_API_KEY: 'test-key' }),
  'environment',
)

assert.equal(
  brainProviderStatus({ ORBIA_BRAIN_PROVIDER: 'openai' }).configured,
  false,
)
assert.equal(
  brainProviderStatus({
    ORBIA_BRAIN_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
  }).configured,
  true,
)

assert.equal(
  brainProviderStatus({ ORBIA_BRAIN_PROVIDER: 'hybrid' }).configured,
  true,
)
assert.equal(
  brainProviderStatus({ ORBIA_BRAIN_PROVIDER: 'hybrid' }).cloudConfigured,
  false,
)
assert.equal(
  brainProviderStatus({
    ORBIA_BRAIN_PROVIDER: 'hybrid',
    OPENAI_API_KEY: 'test-key',
  }).cloudConfigured,
  true,
)

console.log('BPA-01 brain provider abstraction: PASS')
console.log('Providers: ollama local · openai cloud · hybrid router · claude compatibility')
console.log('OpenAI key remains server-side environment state')
