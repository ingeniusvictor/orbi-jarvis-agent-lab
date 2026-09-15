/**
 * O.R.B.I.A. canonical provider-neutral contracts.
 *
 * C1 convergence foundation: these small runtime contracts are deliberately
 * independent from Ollama, Claude, the holographic UI and the legacy ChatBox.
 * Future Companion / Studio / Widget surfaces should converge on these shapes
 * instead of each inventing their own memory/tool/provider envelopes.
 */

export const CONTRACT_VERSION = '1'

const freeze = (value) => Object.freeze(value)

export function createConversationTurn({
  id,
  conversationId,
  role,
  content,
  createdAt = new Date().toISOString(),
}) {
  if (!id || !conversationId) throw new Error('Conversation turn requires id and conversationId.')
  if (role !== 'user' && role !== 'assistant') throw new Error('Invalid conversation role.')
  if (typeof content !== 'string') throw new Error('Conversation content must be text.')

  return freeze({
    version: CONTRACT_VERSION,
    id,
    conversationId,
    role,
    content,
    createdAt,
  })
}

export function createKnowledgeContext({
  query,
  entries = [],
  source = 'local-static',
  truncated = false,
}) {
  if (typeof query !== 'string') throw new Error('Knowledge query must be text.')
  if (!Array.isArray(entries)) throw new Error('Knowledge entries must be an array.')

  const normalizedEntries = entries.map((entry) =>
    freeze({
      id: String(entry.id ?? ''),
      sourceId: entry.sourceId ? String(entry.sourceId) : undefined,
      sourceType: String(entry.sourceType ?? source),
      domain: String(entry.domain ?? 'system'),
      title: String(entry.title ?? ''),
      content: String(entry.content ?? ''),
      score: Number.isFinite(entry.score) ? Number(entry.score) : 0,
    }),
  )

  return freeze({
    version: CONTRACT_VERSION,
    query,
    source,
    matchCount: normalizedEntries.length,
    entries: freeze(normalizedEntries),
    totalCharacters: normalizedEntries.reduce(
      (sum, entry) => sum + entry.title.length + entry.content.length,
      0,
    ),
    truncated: Boolean(truncated),
  })
}

export function createToolRequest({
  id,
  conversationId,
  name,
  input = {},
}) {
  if (!id || !conversationId) throw new Error('Tool request requires id and conversationId.')
  if (!/^[a-z0-9_-]{1,80}$/.test(String(name ?? ''))) {
    throw new Error('Invalid canonical tool name.')
  }

  return freeze({
    version: CONTRACT_VERSION,
    id,
    conversationId,
    name,
    input,
  })
}

export function createToolResult({
  requestId,
  name,
  ok,
  value,
  errorCode,
  durationMs = 0,
}) {
  return freeze({
    version: CONTRACT_VERSION,
    requestId: String(requestId ?? ''),
    name: String(name ?? ''),
    ok: Boolean(ok),
    value,
    errorCode: errorCode ? String(errorCode) : undefined,
    durationMs: Math.max(0, Number(durationMs) || 0),
  })
}

export function createPermissionDecision({
  toolName,
  allowed,
  reason,
  risk = 'read-only',
}) {
  return freeze({
    version: CONTRACT_VERSION,
    toolName: String(toolName ?? ''),
    allowed: Boolean(allowed),
    reason: String(reason ?? ''),
    risk,
  })
}

export function createRuntimeState({
  conversationId,
  provider,
  model,
  phase,
}) {
  return freeze({
    version: CONTRACT_VERSION,
    conversationId: String(conversationId ?? ''),
    provider: String(provider ?? ''),
    model: String(model ?? ''),
    phase: String(phase ?? ''),
  })
}
