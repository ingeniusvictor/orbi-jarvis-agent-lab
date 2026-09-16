/**
 * O.R.B.I.A. local provider — Ollama adapter.
 *
 * The provider now consumes the canonical L.U.M.I.A. identity projection from
 * bridge/orbia rather than owning a second personality inside this file.
 * Tool execution remains disabled during the C1 convergence step.
 */

import { composeLumiaVoiceSystemPrompt } from './orbia/lumia-identity.mjs'
import {
  appendConversationExchange,
  getConversationHistory,
} from './orbia/conversation.mjs'
import {
  buildKnowledgeContext,
  knowledgeContextToPrompt,
} from './orbia/knowledge.mjs'
import { createToolRequest } from './orbia/contracts.mjs'
import { createReadOnlyDiagnosticTools } from './orbia/diagnostic-tools.mjs'
import { ToolExecutor, ToolRegistry } from './orbia/tool-engine.mjs'

const DEFAULT_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen3:4b'

export const OLLAMA_URL = (process.env.JARVIS_OLLAMA_URL ?? DEFAULT_URL).replace(/\/+$/, '')
export const OLLAMA_MODEL = process.env.JARVIS_OLLAMA_MODEL ?? DEFAULT_MODEL
export const OLLAMA_KEEP_ALIVE = process.env.JARVIS_OLLAMA_KEEP_ALIVE ?? '2h'
export const OLLAMA_VOICE_NUM_PREDICT = Math.max(
  48,
  Math.min(180, Number(process.env.JARVIS_OLLAMA_NUM_PREDICT) || 120),
)

const localToolRegistry = new ToolRegistry()
for (const tool of createReadOnlyDiagnosticTools({
  provider: 'ollama',
  model: OLLAMA_MODEL,
})) {
  localToolRegistry.register(tool)
}
const localToolExecutor = new ToolExecutor(localToolRegistry)
const LOCAL_READ_ONLY_TOOLS = Object.freeze(
  localToolRegistry.list().map((tool) => tool.name),
)

export const ORBI_LOCAL_SYSTEM_PROMPT = composeLumiaVoiceSystemPrompt({
  toolsEnabled: false,
  knowledgeEnabled: false,
})

export function selectReadOnlyTool(prompt, conversationId, requestId) {
  const text = String(prompt ?? '').trim().toLowerCase()

  if (
    text.includes('estado del sistema') ||
    text.includes('estado de orbia') ||
    text.includes('estado de lumia') ||
    text.includes('qué modelo estás usando') ||
    text.includes('que modelo estas usando') ||
    text.includes('qué proveedor estás usando') ||
    text.includes('que proveedor estas usando')
  ) {
    return createToolRequest({
      id: requestId,
      conversationId,
      name: 'orbi_runtime_status',
      input: {},
    })
  }

  if (
    text.includes('estado de la conversación') ||
    text.includes('estado de la conversacion') ||
    text.includes('cuántos mensajes llevamos') ||
    text.includes('cuantos mensajes llevamos') ||
    text.includes('cuántos turnos llevamos') ||
    text.includes('cuantos turnos llevamos')
  ) {
    return createToolRequest({
      id: requestId,
      conversationId,
      name: 'orbi_conversation_status',
      input: {},
    })
  }

  const knowledgePrefixes = [
    'busca en el conocimiento ',
    'consulta el conocimiento ',
    'revisa el conocimiento ',
  ]
  const prefix = knowledgePrefixes.find((value) => text.startsWith(value))
  if (prefix) {
    const query = String(prompt).slice(prefix.length).trim()
    if (query) {
      return createToolRequest({
        id: requestId,
        conversationId,
        name: 'orbi_knowledge_search',
        input: { query },
      })
    }
  }

  return null
}

export function toolResultToPrompt(execution) {
  if (!execution?.result) return ''
  if (!execution.result.ok) {
    return [
      'RESULTADO DE HERRAMIENTA O.R.B.I.A.:',
      `herramienta=${execution.result.name}`,
      `estado=ERROR`,
      `codigo=${execution.result.errorCode ?? 'TOOL_FAILED'}`,
      'Explica el fallo brevemente y no inventes un resultado.',
    ].join('\n')
  }

  return [
    'RESULTADO DE HERRAMIENTA O.R.B.I.A. (SOLO LECTURA):',
    `herramienta=${execution.result.name}`,
    `valor=${execution.result.value ?? ''}`,
    'Usa este resultado como fuente de verdad para responder esta pregunta.',
  ].join('\n')
}

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
          keep_alive: OLLAMA_KEEP_ALIVE,
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
  knowledgeContext,
  toolContext,
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
        (knowledgeContextToPrompt(knowledgeContext)
          ? '\n' + knowledgeContextToPrompt(knowledgeContext)
          : '') +
        (toolContext ? '\n' + toolContext : '') +
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
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: 0,
          // Voice replies are intentionally short. This prevents a malformed
          // local turn from generating hundreds of tokens before the user
          // hears anything, while leaving ample room for two spoken sentences.
          num_predict: OLLAMA_VOICE_NUM_PREDICT,
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

    const totalMs = Number(packet?.total_duration ?? 0) / 1_000_000
    const promptMs = Number(packet?.prompt_eval_duration ?? 0) / 1_000_000
    const evalMs = Number(packet?.eval_duration ?? 0) / 1_000_000
    const evalCount = Number(packet?.eval_count ?? 0)
    const tokensPerSecond =
      evalMs > 0 && evalCount > 0 ? (evalCount / evalMs) * 1000 : 0

    console.log(
      '[orbia] LUMIA local latency' +
        ` total=${totalMs.toFixed(0)}ms` +
        ` prompt=${promptMs.toFixed(0)}ms` +
        ` generate=${evalMs.toFixed(0)}ms` +
        ` output=${evalCount}tok` +
        (tokensPerSecond ? ` speed=${tokensPerSecond.toFixed(1)}tok/s` : ''),
    )

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
export function attachOllamaSession(socket) {
  const socketConversationId =
    `lumia-socket-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
    const conversationId =
      typeof msg.conversationId === 'string' && msg.conversationId.trim()
        ? msg.conversationId.trim().slice(0, 160)
        : socketConversationId
    const prompt = msg.text.trim()
    if (!prompt) {
      send({ type: 'done', ask, text: '' })
      return
    }

    void (async () => {
      let answer = ''
      try {
        const history = getConversationHistory(conversationId)
        const knowledgeContext = buildKnowledgeContext(prompt)
        const toolRequest = selectReadOnlyTool(
          prompt,
          conversationId,
          `${ask ?? 'turn'}-tool`,
        )

        let toolContext = ''
        let toolExecution = null
        if (toolRequest) {
          send({ type: 'tool', ask, name: toolRequest.name })
          toolExecution = await localToolExecutor.execute(toolRequest, {
            allowed: LOCAL_READ_ONLY_TOOLS,
          })
          toolContext = toolResultToPrompt(toolExecution)
        }

        answer = await streamOllama({
          prompt,
          history,
          systemPrompt: composeLumiaVoiceSystemPrompt({
            toolsEnabled: Boolean(toolRequest),
            knowledgeEnabled: knowledgeContext.entries.length > 0,
          }),
          knowledgeContext,
          toolContext,
          signal: controller.signal,
          onText: (delta) => send({ type: 'text', ask, delta }),
        })

        if (closed || controller.signal.aborted) return

        appendConversationExchange(conversationId, prompt, answer)

        send({
          type: 'done',
          ask,
          conversationId,
          text: answer,
          grounded: knowledgeContext.entries.length > 0,
          sourceEntryIds: knowledgeContext.entries.map((entry) => entry.id),
          toolName: toolRequest?.name,
          toolOk: toolExecution?.result?.ok,
        })
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
