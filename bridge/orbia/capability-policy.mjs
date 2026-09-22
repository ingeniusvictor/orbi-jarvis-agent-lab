/**
 * L8 Capability Security Policy.
 *
 * Risk classification only. This module does not grant execution by itself.
 * Existing bridge permission gates remain authoritative until Voice Gate
 * liveness is certified.
 */

const READ =
  /^(?:get|list|read|search|find|query|fetch|check|describe|inspect|show|view|explain|screenshot|status)/i

const CRITICAL =
  /(?:send|mail|email|call|outbound|buy|purchase|pay|charge|transfer|delete|remove|erase|publish|deploy|book|reserve|shutdown|reboot|factory|reset)/i

const SENSITIVE =
  /(?:create|update|edit|write|install|launch|open|close|navigate|tap|swipe|press|type|download|upload|move|rename|start|stop|enable|disable|set|change)/i

const GENERATIVE_SERVERS = new Set([
  'higgsfield',
  'heygen',
  'elevenlabs',
  'openrouter',
  'openrouter-image',
])

function toolPart(name) {
  const raw = String(name ?? '')
  if (!raw.startsWith('mcp__')) return raw
  return raw.split('__').slice(2).join('__')
}

function serverPart(name) {
  const raw = String(name ?? '')
  if (!raw.startsWith('mcp__')) return ''
  return raw.split('__')[1] ?? ''
}

export function classifyCapability(name) {
  const raw = String(name ?? '').trim()
  const tool = toolPart(raw)
  const server = serverPart(raw)

  let level = 'N2'
  let reason = 'unknown-effect'

  if (CRITICAL.test(tool)) {
    level = 'N3'
    reason = 'critical-effect'
  } else if (READ.test(tool)) {
    level = 'N1'
    reason = 'read-only'
  } else if (
    GENERATIVE_SERVERS.has(server) &&
    !SENSITIVE.test(tool) &&
    !CRITICAL.test(tool)
  ) {
    level = 'N1'
    reason = 'bounded-generation'
  } else if (SENSITIVE.test(tool)) {
    level = 'N2'
    reason = 'reversible-effect'
  }

  return Object.freeze({
    level,
    reason,
    confirmation:
      level === 'N1' ? 'none' : level === 'N2' ? 'conditional' : 'fresh',
    rememberable: level === 'N2',
    remoteAllowed: level === 'N1',
    requiresAuthorizedSpeaker: level !== 'N1',
    requiresLiveHuman: level === 'N3',
  })
}

export function canRememberCapability(name) {
  return classifyCapability(name).rememberable
}
