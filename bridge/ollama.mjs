/**
 * O.R.B.I.A. local provider — Ollama adapter.
 *
 * The provider now consumes the canonical L.U.M.I.A. identity projection from
 * bridge/orbia rather than owning a second personality inside this file.
 * Tool execution remains disabled during the C1 convergence step.
 */

import {
  composeLumiaVoiceSystemPrompt,
  sanitizeLumiaVoiceOutput,
} from './orbia/lumia-identity.mjs'
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
import {
  buildModelInventory,
  getActiveModel,
  parseModelControl,
  resolveModelRequest,
  setActiveModel,
} from './orbia/model-manager.mjs'
import { buildVoiceRuntimeStatus } from './orbia/voice-status.mjs'
import { applyVoiceRuntimeControl } from './orbia/voice-control.mjs'
import { parseVoiceRuntimeControl } from './orbia/voice-runtime.mjs'
import { createOllamaReplyGate } from './orbia/ollama-json-stream.mjs'
import { isStaleModelReply } from './orbia/stale-answer-guard.mjs'
import { isGenericReplyForQuestion, safeClarificationForQuestion } from './orbia/response-relevance-rc02.mjs'
import { isComplexVoicePrompt, COMPLEX_VOICE_INSTRUCTION } from './orbia/complex-voice-intent.mjs'
import { parseLocalVisualImage } from './orbia/visual-input.mjs'

const DEFAULT_URL = 'http://127.0.0.1:11434'
export const OLLAMA_URL = (process.env.JARVIS_OLLAMA_URL ?? DEFAULT_URL).replace(/\/+$/, '')
export const OLLAMA_MODEL = getActiveModel()
export const getOllamaModel = getActiveModel
export const OLLAMA_KEEP_ALIVE = process.env.JARVIS_OLLAMA_KEEP_ALIVE ?? '2h'
export const OLLAMA_VOICE_NUM_PREDICT = Math.max(
  48,
  Math.min(180, Number(process.env.JARVIS_OLLAMA_NUM_PREDICT) || 120),
)

// Default conservative buffered JSON. Experimental streamed Spanish reply
// requires explicit opt-in; do not emit a raw Ollama thinking channel.
const STREAM_VOICE = process.env.ORBIA_OLLAMA_VOICE_STREAM === '1'
const getVoiceRuntimeSnapshot = () => buildVoiceRuntimeStatus()

const localToolRegistry = new ToolRegistry()
for (const tool of createReadOnlyDiagnosticTools({
  provider: 'ollama',
  getModel: getActiveModel,
  getVoiceRuntime: getVoiceRuntimeSnapshot,
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

  if (
    text.includes('estado de la voz') ||
    text.includes('estado del sistema de voz') ||
    text.includes('qué modo de voz estás usando') ||
    text.includes('que modo de voz estas usando') ||
    text.includes('qué reconocimiento de voz estás usando') ||
    text.includes('que reconocimiento de voz estas usando')
  ) {
    return createToolRequest({
      id: requestId,
      conversationId,
      name: 'orbi_voice_runtime_status',
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

function modelInventoryToSpeech(models) {
  const inventory = buildModelInventory(models)
  if (!inventory.length) {
    return 'No encuentro modelos locales instalados en Ollama.'
  }

  const names = inventory
    .map((item) => item.active ? `${item.name}, activo` : item.name)
    .join(', ')

  return `Tengo ${inventory.length} modelos instalados en Ollama: ${names}.`
}

function modelInventoryCountToSpeech(models) {
  const inventory = buildModelInventory(models)
  if (!inventory.length) {
    return 'No encuentro modelos locales instalados en Ollama.'
  }
  const active = inventory.find((item) => item.active)?.name
  return `Tengo ${inventory.length} modelos locales instalados en Ollama.` +
    (active ? ` Ahora estoy usando ${active}.` : '')
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

const warmPromises = new Map()

function warmTimeoutMsForModel(model) {
  const name = String(model ?? '').toLowerCase()
  if (/\b(?:14b|32b|70b)\b/.test(name)) return 180_000
  if (/\b(?:7b|8b)\b/.test(name)) return 120_000
  return 60_000
}

export function warmOllama(model = getActiveModel()) {
  if (warmPromises.has(model)) return warmPromises.get(model)

  const started = Date.now()
  const promise = (async () => {
    try {
      // A blank /api/generate request can load weights without exercising the
      // chat template/context path. The first spoken question then still pays
      // that setup cost. Warm the exact chat route instead, but cap generation
      // to a handful of tokens so startup work is done without wasting time.
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
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
        signal: AbortSignal.timeout(warmTimeoutMsForModel(model)),
      })
      const ok = res.ok
      if (ok) {
        console.log(
          `[lumia] chat warm-up completed · ${model} · ${((Date.now() - started) / 1000).toFixed(1)}s`,
        )
      } else {
        const detail = await res.text().catch(() => '')
        console.warn(
          `[lumia] warm-up failed · ${model} · HTTP ${res.status}` +
            (detail ? ` · ${detail.slice(0, 240)}` : ''),
        )
      }
      return ok
    } catch (err) {
      console.warn(
        `[lumia] warm-up failed · ${model} · ${String(err?.name ?? 'Error')}: ${String(err?.message ?? err)}`,
      )
      return false
    }
  })()

  warmPromises.set(model, promise)

  // A failed warm-up must not poison that model forever.
  promise.then((ok) => {
    if (!ok) warmPromises.delete(model)
  })

  return promise
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
  image,
  signal,
  onText,
}) {
  const model = getActiveModel()
  const complexVoice = process.env.ORBIA_LUMIA_COMPLEX_VOICE_VQ01 === '1' && isComplexVoicePrompt(prompt) && !image

  // Reuse the warm-up for the model selected at the start of this turn.
  await warmOllama(model)
  const messages = [
    {
      role: 'system',
      content:
        systemPrompt +
        (knowledgeContextToPrompt(knowledgeContext)
          ? '\n' + knowledgeContextToPrompt(knowledgeContext)
          : '') +
        (toolContext ? '\n' + toolContext : '') +
        (complexVoice ? COMPLEX_VOICE_INSTRUCTION : '') +
        '\nDevuelve exclusivamente un objeto JSON válido con esta forma exacta: ' +
        '{"respuesta":"texto final para pronunciar"}. ' +
        'El valor de respuesta debe estar completamente en español latinoamericano, ' +
        'salvo que el usuario pida explícitamente otro idioma. No incluyas análisis, ' +
        'traducciones, explicaciones del idioma ni texto fuera del JSON.',
    },
    ...history,
    {
      role: 'user',
      content: prompt,
      ...(image ? { images: [image.data] } : {}),
    },
  ]

  // A multimodal turn uses Ollama's native image field, with an explicit
  // owner-selected photograph. The normal structured audio-only flow below is
  // unchanged. Native plain text avoids cutting useful visual analysis inside
  // the short JSON voice-response contract.
  if (image) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt +
              '\\nEstás examinando una foto proporcionada expresamente por el usuario. ' +
              'Describe observaciones visuales; distingue claramente hipótesis. ' +
              'No inventes detalles, y no repitas teléfonos ni identificadores privados. ' +
              'Responde en español con frases naturales, breves y completas.',
          },
          ...history,
          { role: 'user', content: prompt, images: [image.data] },
        ],
        stream: false,
        think: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: { temperature: 0, num_ctx: 4096, num_predict: 256 },
      }),
      signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(
        `Ollama visual HTTP ${res.status}` +
        (detail ? `: ${detail.slice(0, 160)}` : ''),
      )
    }
    const packet = await res.json()
    const answer = sanitizeLumiaVoiceOutput(
      String(packet?.message?.content ?? '').trim(),
    )
    if (!answer) throw new Error('Ollama no entregó una descripción visual.')
    // No image data in logs, transcript or process-local history.
    const totalMs = Number(packet?.total_duration ?? 0) / 1_000_000
    const promptMs = Number(packet?.prompt_eval_duration ?? 0) / 1_000_000
    const loadMs = Number(packet?.load_duration ?? 0) / 1_000_000
    console.log(
      `[lumia] visual local model=${model} total=${totalMs.toFixed(0)}ms` +
      ` input=${promptMs.toFixed(0)}ms load=${loadMs.toFixed(0)}ms` +
      ` outputTokens=${Number(packet?.eval_count ?? 0)}`,
    )
    onText(answer)
    return answer
  }

  const responseSchema = {
    type: 'object',
    properties: {
      respuesta: { type: 'string' },
    },
    required: ['respuesta'],
    additionalProperties: false,
  }

  const runStructured = async (requestMessages, numPredict = OLLAMA_VOICE_NUM_PREDICT) => {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
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
          num_predict: numPredict,
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
      `[orbia] LUMIA local latency model=${model}` +
        ` done_reason=${String(packet?.done_reason ?? 'unknown').slice(0,24)}` +
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

  if (STREAM_VOICE) {
    const gate = createOllamaReplyGate({ onText })
    let rawLines = ''
    let chunks = 0
    let lastPacket = null
    const streamedStartedAt = performance.now()
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model, messages, stream: true, think: false,
          format: responseSchema,
          keep_alive: OLLAMA_KEEP_ALIVE,
          options: { temperature: 0, num_predict: OLLAMA_VOICE_NUM_PREDICT },
        }),
        signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`Ollama streaming unavailable: HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const consume = (line) => {
        if (!line.trim()) return
        if (++chunks > 4000) throw new Error('Ollama stream exceeded the safe packet limit')
        const packet = JSON.parse(line)
        if (packet.error) throw new Error('Ollama streaming returned an error')
        const delta = packet.message?.content
        if (typeof delta === 'string' && delta) gate.feed(delta)
        if (packet.done === true) lastPacket = packet
      }
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          rawLines += decoder.decode(value, { stream: true })
          if (rawLines.length > 128 * 1024) throw new Error('Ollama stream buffer overflow')
          let nl
          while ((nl = rawLines.indexOf('\n')) >= 0) {
            const line = rawLines.slice(0, nl)
            rawLines = rawLines.slice(nl + 1)
            consume(line)
          }
        }
        rawLines += decoder.decode()
        if (rawLines.trim()) consume(rawLines)
      } finally {
        reader.releaseLock()
      }
      if (!lastPacket) throw new Error('Ollama stream ended without a completion marker')
      const streamed = gate.finish()
      const finalText = sanitizeLumiaVoiceOutput(streamed)
      // All already-emitted speech must be a prefix of the final answer.
      // This is an opt-in experiment; if a model violates the contract after
      // audible output, signal the error rather than replaying duplicate text.
      if (!finalText) throw new Error('Ollama streamed response empty')
      const totalMs = Number(lastPacket.total_duration ?? 0) / 1_000_000
      const promptMs = Number(lastPacket.prompt_eval_duration ?? 0) / 1_000_000
      const evalMs = Number(lastPacket.eval_duration ?? 0) / 1_000_000
      const tokens = Number(lastPacket.eval_count ?? 0)
      console.log(
        `[orbia] LUMIA streamed latency model=${model}` +
        ` observed=${Math.round(performance.now() - streamedStartedAt)}ms` +
        ` total=${totalMs.toFixed(0)}ms prompt=${promptMs.toFixed(0)}ms` +
        ` generate=${evalMs.toFixed(0)}ms output=${tokens}tok` +
        (evalMs > 0 ? ` speed=${(tokens / evalMs * 1000).toFixed(1)}tok/s` : ''),
      )
      return finalText
    } catch (error) {
      if (signal?.aborted) throw error
      // A partial answer may already have been spoken; repeating it with the
      // buffered fallback would be confusing and could double-execute intent.
      if (gate.startedSpeaking) throw error
      console.warn('[lumia] stream unavailable before speech; using validated buffered answer')
    }
  }

  // Ordinary voice stays at the fast 120-token budget. Complex interventions
  // get room to answer each understood question instead of one stock sentence.
  const raw = await runStructured(messages, complexVoice ? 320 : OLLAMA_VOICE_NUM_PREDICT)
  let text = parseAnswer(raw)

  // Recover one malformed structured reply using the actual latest question.
  // Never ask Ollama to reformat only its invalid output: that loses the user
  // intent. Keep the usual 120-token limit for successful first attempts.
  if (!text) {
    console.warn('[lumia] invalid local JSON: retrying latest user question once')
    const recent = Array.isArray(history) ? history.slice(-2) : []
    const retryMessages = [
      {
        role: 'system',
        content:
          systemPrompt +
          '\nResponde ÚNICAMENTE a la última pregunta. El contexto anterior ' +
          'sirve para interpretar referencias, no para repetir respuestas viejas. ' +
          'Responde en una o dos frases breves, sin inventar información. ' +
          'Devuelve solamente un objeto JSON con la propiedad "respuesta".',
      },
      ...recent,
      { role: 'user', content: prompt },
    ]
    const retriedRaw = await runStructured(retryMessages, 256)
    text = parseAnswer(retriedRaw)
    if (!text) {
      console.warn('[lumia] JSON still invalid after one local retry')
      text = 'Te escuché, pero el modelo local no pudo generar una respuesta válida. ¿Puedes repetir tu pregunta?'
    }
  }

  text = sanitizeLumiaVoiceOutput(text)

  // A smaller local model may answer a *new* question by recycling a long
  // earlier reply. Do not play the previous answer as if it were new.
  // The model path is buffered on the ASUS, so one bounded retry is safe.
  if (isStaleModelReply({ answer: text, prompt, history }) || isGenericReplyForQuestion({ answer: text, prompt })) {
    console.warn('[lumia] probable repeated old answer to a different user prompt; retrying once')
    const latestPriorUser = [...history].reverse().find((entry) => entry.role === 'user')
    const correctionMessages = [
      {
        role: 'system',
        content:
          systemPrompt +
          '\nLa pregunta ACTUAL del usuario tiene prioridad absoluta sobre el contexto. ' +
          'Tu respuesta previa fue rechazada por ser repetitiva o genérica en lugar de responder la pregunta actual. ' +
          'Responde SOLO la última pregunta; no repitas tu respuesta anterior. ' +
          'Devuelve exclusivamente JSON {"respuesta":"una respuesta nueva y pertinente"}.',
      },
      ...(latestPriorUser ? [{
        role: 'user',
        content: 'Contexto de la conversación anterior, NO es la pregunta actual: ' +
          String(latestPriorUser.content).slice(0, 360),
      }] : []),
      { role: 'user', content: prompt },
    ]
    try {
      const retryText = sanitizeLumiaVoiceOutput(
        parseAnswer(await runStructured(correctionMessages)),
      )
      if (retryText && !isStaleModelReply({ answer: retryText, prompt, history }) && !isGenericReplyForQuestion({ answer: retryText, prompt })) {
        text = retryText
      } else {
        console.warn('[lumia] regenerated reply remained stale; returning a brief explicit non-answer')
        text = safeClarificationForQuestion(prompt)
      }
    } catch (error) {
      if (signal?.aborted) throw error
      console.warn('[lumia] repeated-reply regeneration failed:', String(error?.message ?? error).slice(0,120))
      text = safeClarificationForQuestion(prompt)
    }
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
        // One single local photo; malformed payloads fail before model call.
        // It is never added to chat history, console output or diagnostics.
        const image = parseLocalVisualImage(msg.image)
        if (image && process.env.ORBIA_LUMIA_VISION_ENABLED !== '1') {
          throw new Error('Visión experimental deshabilitada en este bridge.')
        }
        const voiceControl = image ? null : parseVoiceRuntimeControl(prompt)

        if (voiceControl) {
          send({ type: 'tool', ask, name: 'orbi_voice_runtime_control' })
          const applied = applyVoiceRuntimeControl(voiceControl)
          answer = applied.answer

          if (closed || controller.signal.aborted) return

          appendConversationExchange(conversationId, prompt, answer)
          send({
            type: 'voice_runtime',
            ask,
            voice: applied.status,
          })
          send({ type: 'text', ask, delta: answer })
          send({
            type: 'done',
            ask,
            conversationId,
            text: answer,
            voiceControl: voiceControl.action,
            voiceChanged: applied.changed,
          })
          return
        }

        const modelControl = image ? null : parseModelControl(prompt, history)

        if (modelControl) {
          const toolName =
            modelControl.action === 'switch'
              ? 'orbi_model_switch'
              : 'orbi_model_registry'

          send({ type: 'tool', ask, name: toolName })

          const probe = await probeOllama()
          if (!probe.ok) {
            answer = 'No puedo consultar los modelos locales porque Ollama no está disponible.'
          } else if (modelControl.action === 'count') {
            answer = modelInventoryCountToSpeech(probe.models)
          } else if (modelControl.action === 'list') {
            answer = modelInventoryToSpeech(probe.models)
          } else {
            const target = resolveModelRequest(modelControl.requested, probe.models)

            if (!target) {
              answer =
                'No encuentro un modelo instalado que coincida con esa solicitud. ' +
                modelInventoryToSpeech(probe.models)
            } else if (target === getActiveModel()) {
              answer = `Ese modelo ya está activo. Estoy usando ${target}.`
            } else {
              const previous = getActiveModel()
              const warm = await warmOllama(target)

              if (!warm) {
                answer =
                  `No pude preparar ${target}. Mantengo activo ${previous}.`
              } else {
                setActiveModel(target)
                answer = `Listo. Ahora estoy usando ${target}.`
              }
            }
          }

          if (closed || controller.signal.aborted) return

          appendConversationExchange(conversationId, prompt, answer)
          send({ type: 'text', ask, delta: answer })
          send({
            type: 'done',
            ask,
            conversationId,
            text: answer,
            modelName: getActiveModel(),
            modelControl: modelControl.action,
          })
          return
        }

        const knowledgeContext = buildKnowledgeContext(prompt)
        const toolRequest = image ? null : selectReadOnlyTool(
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
          image,
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
