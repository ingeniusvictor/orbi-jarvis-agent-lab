import {
  brainProviderStatus,
  listBrainProviders,
  resolveBrainProvider,
} from '../bridge/providers/registry.mjs'
import {
  OPENAI_BASE_URL,
  OPENAI_MODEL,
  openAIConfigured,
} from '../bridge/providers/openai.mjs'
import {
  OLLAMA_URL,
  getOllamaModel,
  probeOllama,
} from '../bridge/ollama.mjs'

const selected = resolveBrainProvider()
const status = brainProviderStatus()

console.log('O.R.B.I.A. / L.U.M.I.A. Brain Doctor')
console.log('------------------------------------')
console.log(`Selected provider: ${status.id} · ${status.displayName}`)
console.log(`Provider kind:     ${status.kind}`)
console.log(`Configured:        ${status.configured ? 'YES' : 'NO'}`)
console.log('')
console.log('Available provider adapters:')
for (const provider of listBrainProviders()) {
  console.log(
    `  ${provider.id.padEnd(8)} · ${provider.kind.padEnd(5)} · ${provider.displayName}`,
  )
}

console.log('')
if (selected.id === 'ollama') {
  console.log(`Ollama URL:         ${OLLAMA_URL}`)
  console.log(`Ollama model:       ${getOllamaModel()}`)
  const probe = await probeOllama()
  console.log(`Ollama reachable:   ${probe.ok ? 'YES' : 'NO'}`)
  console.log(
    `Model installed:    ${probe.models.includes(getOllamaModel()) ? 'YES' : 'NO'}`,
  )
}

if (selected.id === 'openai') {
  console.log(`OpenAI endpoint:    ${OPENAI_BASE_URL}`)
  console.log(`OpenAI model:       ${OPENAI_MODEL}`)
  console.log(
    `OPENAI_API_KEY:     ${openAIConfigured() ? 'CONFIGURED' : 'MISSING'}`,
  )
  console.log('API key value:      [never displayed]')
}

if (selected.id === 'claude') {
  console.log('Claude path:        embedded Agent SDK compatibility')
}

console.log('')
console.log('No secret values were printed.')
