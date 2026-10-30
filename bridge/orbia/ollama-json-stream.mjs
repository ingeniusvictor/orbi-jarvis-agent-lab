/**
 * Experimental Ollama JSON reply gate for low-latency Spanish conversation.
 *
 * Structured output is still requested from Ollama with format schema and
 * think:false. Only bytes inside the exact JSON key "respuesta" can be
 * released progressively. This module never emits JSON scaffolding or
 * reasoning fields; the owner must explicitly opt in, as an incomplete model
 * response may have already yielded audible content.
 */
const HEADER = /^\s*\{\s*"respuesta"\s*:\s*"/
const MAX_CONTENT = 32_768
const MIN_RELEASE = 24

/** Build a complete valid JSON string from a possibly incomplete text prefix. */
function decodedPrefix(raw) {
  let escaped = false
  let safeEnd = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) {
      if (ch === 'u') {
        if (raw.length - i < 5) break
        const hex = raw.slice(i + 1, i + 5)
        if (!/^[\da-fA-F]{4}$/.test(hex)) throw new Error('Invalid JSON unicode escape')
        i += 4
      } else if (!'"\\/bfnrt'.includes(ch)) {
        throw new Error('Invalid JSON escape')
      }
      escaped = false
    } else if (ch === '\\') {
      escaped = true
      continue
    } else if (ch === '"' || ch === '\n' || ch === '\r') {
      throw new Error('Unexpected JSON string delimiter')
    }
    safeEnd = i + 1
  }
  return JSON.parse('"' + raw.slice(0, safeEnd) + '"')
}

export function createOllamaReplyGate({ onText = () => {} } = {}) {
  let raw = ''
  let started = false
  let closingAt = -1
  let decoded = ''
  let sent = ''
  let closed = false

  const emitSafeWords = (force = false) => {
    let to = decoded.length
    if (!force) {
      if (to - sent.length < MIN_RELEASE) return
      const wordEnd = Math.max(
        decoded.lastIndexOf(' ', to - 1),
        decoded.lastIndexOf('\n', to - 1),
      )
      if (wordEnd < sent.length) return
      to = wordEnd + 1
    }
    const delta = decoded.slice(sent.length, to)
    if (!delta) return
    // A model can wrap strict JSON with a forbidden speaker intro. Keep
    // experiment conservative and let the existing final identity sanitizer
    // handle the completed string once before any final remainder is emitted.
    onText(delta)
    sent += delta
  }

  const feed = (chunk) => {
    if (closed || !chunk) return
    raw += String(chunk)
    if (raw.length > MAX_CONTENT) throw new Error('Ollama streamed response too large')
    if (!started) {
      const match = HEADER.exec(raw)
      if (!match) {
        // Do not accept arbitrary prose, thoughts, extra keys or markdown.
        // Wait only while the candidate is still a possible header.
        const trimmed = raw.trimStart()
        if (trimmed.length >= 32 || (trimmed && !'{'.startsWith(trimmed[0]))) {
          throw new Error('Ollama stream is not a respuesta JSON object')
        }
        return
      }
      started = true
    }

    const match = HEADER.exec(raw)
    if (!match) throw new Error('Ollama respuesta JSON header corrupted')
    const body = raw.slice(match[0].length)
    let escaped = false
    closingAt = -1
    for (let i = 0; i < body.length; i++) {
      if (escaped) { escaped = false; continue }
      if (body[i] === '\\') { escaped = true; continue }
      if (body[i] === '"') { closingAt = i; break }
    }

    decoded = decodedPrefix(closingAt >= 0 ? body.slice(0, closingAt) : body)
    emitSafeWords(false)
  }

  const finish = () => {
    if (closed) throw new Error('Ollama response already completed')
    closed = true
    const result = JSON.parse(raw)
    if (!result || typeof result !== 'object' || Array.isArray(result) ||
        Object.keys(result).length !== 1 || typeof result.respuesta !== 'string') {
      throw new Error('Ollama final structured response invalid')
    }
    // The decoder and the validated JSON must agree. We never emit arbitrary
    // streamed text if the trailing JSON turns out to be a different object.
    const answer = result.respuesta.trim()
    if (!answer || !answer.startsWith(sent.trimStart())) {
      throw new Error('Ollama streamed answer differs from validated final answer')
    }
    decoded = result.respuesta
    emitSafeWords(true)
    return answer
  }
  return { feed, finish, get startedSpeaking() { return sent.length > 0 } }
}
