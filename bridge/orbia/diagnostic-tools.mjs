/**
 * First C1-D read-only diagnostic tools.
 *
 * These are intentionally local, deterministic and side-effect free. They are
 * the safe first surface for validating the Tool Engine before any broader MCP
 * or OS capability is connected to local Ollama.
 */

import { getConversationHistory } from './conversation.mjs'
import { buildKnowledgeContext } from './knowledge.mjs'

export function createReadOnlyDiagnosticTools({ provider = 'ollama', model = 'unknown', getModel } = {}) {
  return Object.freeze([
    Object.freeze({
      name: 'orbi_runtime_status',
      description: 'Returns the active local ORBIA provider/model status without changing state.',
      risk: 'read-only',
      validate: (input) => input == null || (typeof input === 'object' && !Array.isArray(input)),
      execute: () => ({
        status: 'READY',
        provider,
        model: typeof getModel === 'function' ? getModel() : model,
        toolPolicy: 'C1_READ_ONLY',
      }),
    }),
    Object.freeze({
      name: 'orbi_knowledge_search',
      description: 'Searches the bounded local ORBI Knowledge Engine without network access.',
      risk: 'read-only',
      validate: (input) =>
        Boolean(
          input &&
          typeof input === 'object' &&
          typeof input.query === 'string' &&
          input.query.trim(),
        ),
      execute: (input) => {
        const context = buildKnowledgeContext(input.query)
        return {
          status: context.entries.length ? 'FOUND' : 'NO_KNOWLEDGE_FOUND',
          entryIds: context.entries.map((entry) => entry.id),
          matchCount: context.matchCount,
          truncated: context.truncated,
        }
      },
    }),
    Object.freeze({
      name: 'orbi_conversation_status',
      description: 'Returns bounded local conversation statistics for the active conversation.',
      risk: 'read-only',
      validate: (input) => input == null || (typeof input === 'object' && !Array.isArray(input)),
      execute: (_input, context) => {
        const history = getConversationHistory(context.conversationId)
        return {
          status: 'READY',
          conversationId: context.conversationId,
          messageCount: history.length,
          exchangeCount: Math.floor(history.length / 2),
        }
      },
    }),
  ])
}
