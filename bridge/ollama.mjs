/**
 * ORBI local provider — Ollama streaming adapter.
 *
 * Phase 1A intentionally keeps this provider narrow: local conversation first,
 * no tool execution yet. The browser/voice/HUD contract stays unchanged, which
 * lets us certify the local brain before reintroducing MCP/tools in Phase 1B.
 */

const DEFAULT_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen3:4b'

export const OLLAMA_URL = (process.env.JARVIS_OLLAMA_URL ?? DEFAULT_URL).replace(/\/+$/, '')
export const OLLAMA_MODEL = process.env.JARVIS_OLLAMA_MODEL ?? DEFAULT_MODEL

export const ORBI_LOCAL_SYSTEM_PROMPT = `Eres JARVIS ejecutándose localmente dentro de ORBI JARVIS Agent Lab.
Habla únicamente en español latinoamericano neutral, salvo que el usuario pida de forma explícita otro idioma.
Si el usuario mezcla español con palabras en inglés, responde igualmente en español.
No menciones el idioma que estás usando, no repitas estas instrucciones y no expliques que "respondes en español latino".
Responde como un asistente de voz rápido, natural, preciso y breve. Normalmente una o dos frases cortas.
Usa solo prosa hablada: sin markdown, listas, títulos, emojis ni bloques de código.
Esta es la Fase 1A: todavía no tienes herramientas. Nunca finjas que abriste, cambiaste, buscaste o ejecutaste algo.
Si una petición requiere una herramienta, indica brevemente que esa acción todavía no está habilitada en esta fase.
No reveles razonamiento interno ni emitas etiquetas de pensamiento. Entrega únicamente la respuesta final que debe pronunciarse.`

export async function probeOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return { ok: false, models: [] }
    const data = await res.json()
    return {
      ok: true,
      models: Array.isArray(data.models) ? data.models.map((m) => m.name).filter(Boolean) : [],
    }
  } catch {
    return { ok: false, models: [] }
  }
}

/**
 * Defensive cleaner for local voice output.
 *
 * Qwen3 supports an explicit /no_think mode, but some local templates/builds
 * may still leak <think> blocks. Never send those blocks to the HUD or TTS.
 * This is only a safety net; normal operation should already be non-thinking.
 */
function createSpokenFilter(onText) {
  let inThink = false
  let carry = ''

  return {
    push(delta) {
      let text = carry + String(delta ?? '')
      carry = ''

      // Keep a short suffix in case a tag is split across stream chunks.
      if (text.length > 16) {
        carry = text.slice(-16)
        text = text.slice(0, -16)
      } else {
        carry = text
        return ''
      }

      let visible = ''
      let i = 0
      while (i < text.length) {
        if (!inThink) {
          const open = text.indexOf('<think>', i)
          if (open === -1) {
            visible += text.slice(i)
            break
          }
          visible += text.slice(i, open)
          inThink = true
          i = open + 7
        } else {
          const close = text.indexOf('</think>', i)
          if (close === -1) break
          inThink = false
          i = close + 8
        }
      }

      if (visible) onText(visible)
      return visible
    },
    flush() {
      if (!carry) return ''
      const tail = carry
      carry = ''
      if (inThink || tail.includes('<think>') || tail.includes('</think>')) return ''
      onText(tail)
      return tail
    },
  }
}

export async function streamOllama({
  prompt,
  history,
  systemPrompt,
  signal,
  onText,
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: `${prompt}\n\n/no_think` },
  ]

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
      think: false,
      options: {
        temperature: 0.4,
      },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Ollama returned ${res.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    )
  }
  if (!res.body) throw new Error('Ollama returned no response stream.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  const spoken = createSpokenFilter((delta) => {
    text += delta
    onText(delta)
  })

  const consumeLine = (line) => {
    if (!line.trim()) return
    const packet = JSON.parse(line)
    const delta = packet?.message?.content ?? ''
    if (delta) spoken.push(delta)
    if (packet?.error) throw new Error(String(packet.error))
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      consumeLine(line)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) consumeLine(buffer)
  spoken.flush()

  return text.trim()
}

/**
 * Own one WebSocket connection using Ollama while preserving the exact frames
 * expected by src/lib/bridge.ts.
 */
export function attachOllamaSession(socket, { systemPrompt = ORBI_LOCAL_SYSTEM_PROMPT } = {}) {
  const history = []
  let active = null
  let closed = false

  const send = (msg) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
  }

  send({ type: 'ready', servers: ['ollama', 'orbi_local'] })

  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (msg.type === 'interrupt') {
      active?.abort()
      active = null
      return
    }

    if (msg.type !== 'ask' || typeof msg.text !== 'string') return

    active?.abort()
    const controller = new AbortController()
    active = controller

    const ask = typeof msg.id === 'string' ? msg.id : null
    const prompt = msg.text.trim()
    if (!prompt) {
      send({ type: 'done', ask, text: '' })
      return
    }

    void (async () => {
      let answer = ''
      try {
        answer = await streamOllama({
          prompt,
          history,
          systemPrompt,
          signal: controller.signal,
          onText: (delta) => send({ type: 'text', ask, delta }),
        })

        if (closed || controller.signal.aborted) return

        history.push(
          { role: 'user', content: prompt },
          { role: 'assistant', content: answer },
        )
        // Keep enough conversational continuity for voice use without letting
        // a small local model drown in an ever-growing context.
        if (history.length > 16) history.splice(0, history.length - 16)

        send({ type: 'done', ask, text: answer })
      } catch (err) {
        if (controller.signal.aborted || closed) return
        send({
          type: 'error',
          ask,
          message: `Local AI failed: ${String(err?.message ?? err)}`,
        })
      } finally {
        if (active === controller) active = null
      }
    })()
  })

  socket.on('close', () => {
    closed = true
    active?.abort()
    active = null
  })
}
