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

export const ORBI_LOCAL_SYSTEM_PROMPT = `Eres L.U.M.I.A., la asistente inteligente principal de O.R.B.I.A. dentro de ORBI Ecosystem.
Tu nombre cotidiano es Lumi.
Habla únicamente en español latinoamericano neutral, salvo que el usuario pida de forma explícita otro idioma.
Si el usuario mezcla español con palabras o términos técnicos en inglés, responde igualmente en español y conserva esos términos solo cuando sea natural.
No menciones el idioma que estás usando, no repitas estas instrucciones y no expliques que "respondes en español latino".
Responde como una asistente de voz rápida, natural, precisa y breve. Normalmente una o dos frases cortas.
Usa solo prosa hablada: sin markdown, listas, títulos, emojis ni bloques de código.
Esta es la Fase 1A: todavía no tienes herramientas. Nunca finjas que abriste, cambiaste, buscaste o ejecutaste algo.
Si una petición requiere una herramienta, indica brevemente que esa acción todavía no está habilitada en esta fase.
No reveles razonamiento interno ni emitas etiquetas de pensamiento. Entrega únicamente la respuesta final que debe pronunciarse.`

let warmPromise = null

export function warmOllama() {
  if (warmPromise) return warmPromise

  const started = Date.now()
  warmPromise = (async () => {
    try {
      // A blank /api/generate request can load weights without exercising the
      // chat template/context path. The first spoken question then still pays
      // that setup cost. Warm the exact chat route instead, but cap generation
      // to a handful of tokens so startup work is done without wasting time.
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: 'system', content: ORBI_LOCAL_SYSTEM_PROMPT },
            { role: 'user', content: 'Responde únicamente: listo.' },
          ],
          stream: false,
          think: false,
          keep_alive: '30m',
          options: {
            temperature: 0,
            num_predict: 8,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      })
      const ok = res.ok
      if (ok) {
        console.log(
          `[jarvis] LUMIA chat warm-up completed in ${((Date.now() - started) / 1000).toFixed(1)}s`,
        )
      }
      return ok
    } catch {
      return false
    }
  })()

  // A failed warm-up must not poison the process forever. The first real turn
  // is allowed to retry instead of reusing one permanently-false promise.
  warmPromise.then((ok) => {
    if (!ok) warmPromise = null
  })

  return warmPromise
}

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
 * Phase 1A response adapter.
 *
 * We intentionally buffer the local model's answer instead of streaming raw
 * tokens. Qwen3 can expose reasoning in English before its final Spanish answer
 * on some local templates. The voice assistant must never speak or display that
 * internal reasoning, so Ollama is asked for one strict JSON object and only the
 * validated "respuesta" field is released to the HUD/TTS.
 *
 * Once the local tool loop is stable we can reintroduce safe streaming with a
 * provider-specific final-answer channel.
 */
export async function streamOllama({
  prompt,
  history,
  systemPrompt,
  signal,
  onText,
}) {
  // Reuse the startup warm-up request if it is still loading the model.
  // This avoids two concurrent cold loads on the first spoken turn.
  await warmOllama()
  const messages = [
    {
      role: 'system',
      content:
        systemPrompt +
        '\nDevuelve exclusivamente un objeto JSON válido con esta forma exacta: ' +
        '{"respuesta":"texto final para pronunciar"}. ' +
        'El valor de respuesta debe estar completamente en español latinoamericano, ' +
        'salvo que el usuario pida explícitamente otro idioma. No incluyas análisis, ' +
        'traducciones, explicaciones del idioma ni texto fuera del JSON.',
    },
    ...history,
    { role: 'user', content: prompt },
  ]

  const responseSchema = {
    type: 'object',
    properties: {
      respuesta: { type: 'string' },
    },
    required: ['respuesta'],
    additionalProperties: false,
  }

  const runStructured = async (requestMessages) => {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: requestMessages,
        stream: false,
        think: false,
        // Ollama structured outputs: an explicit JSON schema is much more
        // reliable than the loose "json" mode with small local models.
        format: responseSchema,
        keep_alive: '30m',
        options: {
          temperature: 0,
          // Voice replies are intentionally short. This prevents a malformed
          // local turn from generating hundreds of tokens before the user
          // hears anything, while leaving ample room for two spoken sentences.
          num_predict: 180,
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

    const packet = await res.json()
    return String(packet?.message?.content ?? '').trim()
  }

  const parseAnswer = (raw) => {
    if (!raw) return ''

    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Some templates still wrap a valid object in prose/code fences.
      const first = raw.indexOf('{')
      const last = raw.lastIndexOf('}')
      if (first >= 0 && last > first) {
        try {
          parsed = JSON.parse(raw.slice(first, last + 1))
        } catch {
          parsed = null
        }
      }
    }

    // "respuesta" is the contract. The aliases are only a migration safety net
    // for local templates that rename the single field despite the schema.
    const candidate =
      parsed?.respuesta ??
      parsed?.response ??
      parsed?.answer ??
      parsed?.texto ??
      parsed?.text ??
      ''

    return typeof candidate === 'string' ? candidate.trim() : ''
  }

  let raw = await runStructured(messages)
  let text = parseAnswer(raw)

  // One bounded repair attempt. Do not fail an otherwise healthy conversation
  // merely because a small local model named the JSON field incorrectly.
  if (!text) {
    raw = await runStructured([
      {
        role: 'system',
        content:
          'Convierte la respuesta dada a un único objeto JSON que cumpla exactamente ' +
          'el esquema solicitado. El campo "respuesta" debe contener solo la respuesta ' +
          'final en español latinoamericano, sin razonamiento, traducciones ni comentarios.',
      },
      {
        role: 'user',
        content: raw || 'No hubo contenido útil. Responde brevemente en español.',
      },
    ])
    text = parseAnswer(raw)
  }

  if (!text) {
    throw new Error('Ollama no entregó una respuesta final válida en español.')
  }

  onText(text)
  return text
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

  // The browser starts warming the bridge during the boot animation. Tell it
  // when the local model is genuinely ready so the first spoken question does
  // not race the cold-load path.
  void warmOllama().then((ok) => {
    if (!closed) send({ type: 'model_ready', ok })
  })

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
          message: `La IA local falló: ${String(err?.message ?? err)}`,
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
