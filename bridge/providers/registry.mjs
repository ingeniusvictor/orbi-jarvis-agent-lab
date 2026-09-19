import { resolveOpenAIKey } from './secure-secrets.mjs'
import { readBrainSettings } from './brain-settings.mjs'

/**
 * O.R.B.I.A. Brain Provider Registry — BPA-01.
 *
 * Keeps provider identity/configuration separate from the transport and UI.
 * Legacy JARVIS_PROVIDER remains supported while L.U.M.I.A. migrates to the
 * ORBIA_BRAIN_PROVIDER contract.
 */

const PROVIDERS = Object.freeze({
  ollama: Object.freeze({
    id: 'ollama',
    displayName: 'Ollama local',
    kind: 'local',
    assistantName: 'L.U.M.I.A.',
    transport: 'external-session',
  }),
  openai: Object.freeze({
    id: 'openai',
    displayName: 'OpenAI API',
    kind: 'cloud',
    assistantName: 'L.U.M.I.A.',
    transport: 'external-session',
  }),
  hybrid: Object.freeze({
    id: 'hybrid',
    displayName: 'ORBI Hybrid Router',
    kind: 'router',
    assistantName: 'L.U.M.I.A.',
    transport: 'external-session',
  }),
  claude: Object.freeze({
    id: 'claude',
    displayName: 'Claude Agent SDK',
    kind: 'cloud',
    assistantName: 'JARVIS',
    transport: 'embedded-sdk',
  }),
})

const ALIASES = Object.freeze({
  local: 'ollama',
  qwen: 'ollama',
  ollama: 'ollama',
  cloud: 'openai',
  gpt: 'openai',
  chatgpt: 'openai',
  openai: 'openai',
  hybrid: 'hybrid',
  hibrido: 'hybrid',
  automatico: 'hybrid',
  auto: 'hybrid',
  anthropic: 'claude',
  claude: 'claude',
})

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

export function listBrainProviders() {
  return Object.freeze(Object.values(PROVIDERS))
}

export function normalizeBrainProvider(value) {
  const key = normalize(value)
  return ALIASES[key] ?? key
}

export function resolveBrainProvider(env = process.env) {
  const saved =
    env === process.env
      ? readBrainSettings()
      : { provider: null }

  const requested =
    env.ORBIA_BRAIN_PROVIDER?.trim() ||
    env.JARVIS_PROVIDER?.trim() ||
    saved.provider ||
    env.ORBIA_BRAIN_DEFAULT?.trim() ||
    'claude'

  const id = normalizeBrainProvider(requested)
  const provider = PROVIDERS[id]

  if (!provider) {
    throw new Error(
      `Unsupported brain provider="${requested}". Use ollama, openai, hybrid or claude.`,
    )
  }

  return Object.freeze({
    ...provider,
    requested,
  })
}

export function brainProviderStatus(env = process.env) {
  const provider = resolveBrainProvider(env)

  return Object.freeze({
    id: provider.id,
    displayName: provider.displayName,
    kind: provider.kind,
    assistantName: provider.assistantName,
    configured:
      provider.id === 'openai'
        ? Boolean(resolveOpenAIKey(env))
        : true,
    cloudConfigured:
      provider.id === 'hybrid'
        ? Boolean(resolveOpenAIKey(env))
        : undefined,
  })
}
