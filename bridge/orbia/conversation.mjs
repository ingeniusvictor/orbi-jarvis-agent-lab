/**
 * Process-local canonical conversation store for C1 convergence.
 *
 * This is intentionally ephemeral: it survives a WebSocket reconnect while the
 * bridge process remains alive, but it is not durable memory. That matches the
 * C1 goal of separating conversation identity from socket lifetime before file
 * persistence is introduced.
 */

const MAX_CONVERSATIONS = 100
const MAX_MESSAGES = 16

const conversations = new Map()

const cleanId = (value) => String(value ?? '').trim().slice(0, 160)

export function getConversationHistory(conversationId) {
  const id = cleanId(conversationId)
  if (!id) return []
  const turns = conversations.get(id) ?? []
  return turns.map((turn) => ({ ...turn }))
}

export function appendConversationExchange(conversationId, userText, assistantText) {
  const id = cleanId(conversationId)
  if (!id) throw new Error('conversationId is required.')

  let turns = conversations.get(id)
  if (!turns) {
    if (conversations.size >= MAX_CONVERSATIONS) {
      const oldest = conversations.keys().next().value
      if (oldest) conversations.delete(oldest)
    }
    turns = []
    conversations.set(id, turns)
  }

  turns.push(
    Object.freeze({ role: 'user', content: String(userText ?? '') }),
    Object.freeze({ role: 'assistant', content: String(assistantText ?? '') }),
  )

  if (turns.length > MAX_MESSAGES) {
    turns.splice(0, turns.length - MAX_MESSAGES)
  }
}

export function hasConversation(conversationId) {
  const id = cleanId(conversationId)
  return Boolean(id && conversations.has(id))
}

export function clearConversation(conversationId) {
  return conversations.delete(cleanId(conversationId))
}
