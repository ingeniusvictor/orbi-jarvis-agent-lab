/**
 * L.U.M.I.A. cloud provider — OpenAI Responses API.
 *
 * The API key stays exclusively in the local bridge process. The browser
 * receives only the same provider-neutral WebSocket frames used by Ollama.
 */

import {
  composeLumiaVoiceSystemPrompt,
  sanitizeLumiaVoiceOutput,
} from '../orbia/lumia-identity.mjs'
import {
  appendConversationExchange,
  getConversationHistory,
} from '../orbia/conversation.mjs'
import { buildVoiceRuntimeStatus } from '../orbia/voice-status.mjs'
import { applyVoiceRuntimeControl } from '../orbia/voice-control.mjs'
import { parseVoiceRuntimeControl } from '../orbia/voice-runtime.mjs'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
export const OPENAI_BASE_URL = (
  process.env.ORBIA_OPENAI_BASE_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, '')
export const OPENAI_MODEL =
  process.env.ORBIA_OPENAI_MODEL?.trim() || 'gpt-5.6-luna'
export const OPENAI_MAX_OUTPUT_TOKENS = Math.max(
  64,
  Math.min(
    1200,
    Number(process.env.ORBIA_OPENAI_MAX_OUTPUT_TOKENS) || 320,
  ),
)

export function openAIConfigured(env = process.env) {
  return Boolean(env.OPENAI_API_KEY?.trim())
}

function responseInput(history, prompt) {
  return [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: 'user',
      content: prompt,
    },
  ]
}

function parseSseFrame(frame) {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  if (!data || data === '[DONE]') return null

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export async function streamOpenAI({
  prompt,
  history = [],
  systemPrompt,
  signal,
  onText,
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'OpenAI API is not configured. Set OPENAI_API_KEY in the local bridge environment.',
    )
  }

  const started = Date.now()
  const res = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: systemPrompt,
      input: responseInput(history, prompt),
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      stream: true,
      store: false,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `OpenAI returned ${res.status}${detail ? `: ${detail.slice(0, 320)}` : ''}`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let answer = ''
  let usage = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })

    for (;;) {
      const boundary = pending.search(/\r?\n\r?\n/)
      if (boundary < 0) break

      const match = /\r?\n\r?\n/.exec(pending.slice(boundary))
      const separatorLength = match?.[0]?.length ?? 2
      const frame = pending.slice(0, boundary)
      pending = pending.slice(boundary + separatorLength)

      const event = parseSseFrame(frame)
      if (!event) continue

      if (
        event.type === 'response.output_text.delta' &&
        typeof event.delta === 'string'
      ) {
        answer += event.delta
        onText(event.delta)
      }

      if (event.type === 'response.completed') {
        usage = event.response?.usage ?? null
      }

      if (
        event.type === 'response.failed' ||
        event.type === 'error'
      ) {
        const message =
          event.response?.error?.message ||
          event.error?.message ||
          event.message ||
          'OpenAI response failed.'
        throw new Error(String(message))
      }
    }
  }

  const text = sanitizeLumiaVoiceOutput(answer.trim())
  if (!text) throw new Error('OpenAI returned an empty final response.')

  console.log(
    `[lumia] OpenAI response · ${OPENAI_MODEL} · ${Date.now() - started}ms` +
      (usage?.input_tokens != null ? ` · in=${usage.input_tokens}` : '') +
      (usage?.output_tokens != null ? ` · out=${usage.output_tokens}` : ''),
  )

  return text
}

export function attachOpenAISession(socket) {
  const socketConversationId =
    `lumia-openai-${Date.now()}-${Math.random().toString(16).slice(2)}`
  let active = null
  let closed = false

  const send = (msg) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg))
    }
  }

  send({
    type: 'ready',
    servers: ['openai', 'orbi_cloud'],
    provider: 'openai',
    modelName: OPENAI_MODEL,
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
        const voiceControl = parseVoiceRuntimeControl(prompt)
        if (voiceControl) {
          send({
            type: 'tool',
            ask,
            name: 'orbi_voice_runtime_control',
          })
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
            provider: 'openai',
            modelName: OPENAI_MODEL,
            voiceControl: voiceControl.action,
            voiceChanged: applied.changed,
          })
          return
        }

        const history = getConversationHistory(conversationId)
        answer = await streamOpenAI({
          prompt,
          history,
          systemPrompt: composeLumiaVoiceSystemPrompt({
            toolsEnabled: false,
            knowledgeEnabled: false,
          }),
          signal: controller.signal,
          onText: (delta) => send({
            type: 'text',
            ask,
            delta,
          }),
        })

        if (closed || controller.signal.aborted) return

        appendConversationExchange(conversationId, prompt, answer)
        send({
          type: 'done',
          ask,
          conversationId,
          text: answer,
          provider: 'openai',
          modelName: OPENAI_MODEL,
        })
      } catch (error) {
        if (controller.signal.aborted || closed) return
        send({
          type: 'error',
          ask,
          message: `La IA cloud falló: ${String(error?.message ?? error)}`,
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

export function openAIBrainStatus() {
  return Object.freeze({
    provider: 'openai',
    configured: openAIConfigured(),
    model: OPENAI_MODEL,
    voice: buildVoiceRuntimeStatus(),
  })
}
