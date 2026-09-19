/**
 * L.U.M.I.A. Hybrid Brain Router — HBR-01.
 *
 * Deterministic, inspectable routing between the local Ollama provider and the
 * OpenAI cloud provider. Cloud is optional: missing credentials or an initial
 * cloud connection failure falls back to local without making L.U.M.I.A.
 * unavailable.
 */

import {
  composeLumiaVoiceSystemPrompt,
} from '../orbia/lumia-identity.mjs'
import {
  appendConversationExchange,
  getConversationHistory,
} from '../orbia/conversation.mjs'
import { buildKnowledgeContext } from '../orbia/knowledge.mjs'
import { applyVoiceRuntimeControl } from '../orbia/voice-control.mjs'
import { parseVoiceRuntimeControl } from '../orbia/voice-runtime.mjs'
import { readBrainSettings } from './brain-settings.mjs'
import { streamOllama, getOllamaModel } from '../ollama.mjs'
import {
  OPENAI_MODEL,
  openAIConfigured,
  streamOpenAI,
} from './openai.mjs'

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const CLOUD_HINTS = [
  /\b(?:analiza|analizar|analisis|compara|comparar|comparacion)\b/,
  /\b(?:disena|disenar|arquitectura|estrategia|planifica|planificacion)\b/,
  /\b(?:diagnostica|diagnosticar|depura|debug|optimiza|optimizar)\b/,
  /\b(?:programa|programar|codigo|coding|typescript|javascript|python)\b/,
  /\b(?:investiga|investigar|razona|razonar|demuestra|demostrar)\b/,
  /\b(?:profundidad|detallado|detallada|paso a paso|complejo|compleja)\b/,
]

const LOCAL_HINTS = [
  /^(?:hola|buenos dias|buenas tardes|buenas noches|gracias)\b/,
  /\b(?:abre|cierra|enciende|apaga|sube|baja)\b/,
  /\b(?:estado de lumia|estado del sistema|que modelo estas usando)\b/,
]

export function parseHybridRouteOverride(prompt) {
  const raw = String(prompt ?? '').trim()

  const cloud = raw.match(
    /^(?:(?:lumi|lumia)[,\s:.-]+)?(?:usa|utiliza|responde con|pregunta a)\s+(?:la\s+)?(?:nube|cloud|openai|gpt)(?:\s+para)?[,\s:.-]+(.+)$/i,
  )
  if (cloud?.[1]) {
    return {
      provider: 'openai',
      prompt: cloud[1].trim(),
      explicit: true,
    }
  }

  const local = raw.match(
    /^(?:(?:lumi|lumia)[,\s:.-]+)?(?:usa|utiliza|responde con)\s+(?:la\s+)?(?:ia\s+)?(?:local|qwen|ollama)(?:\s+para)?[,\s:.-]+(.+)$/i,
  )
  if (local?.[1]) {
    return {
      provider: 'ollama',
      prompt: local[1].trim(),
      explicit: true,
    }
  }

  return null
}

export function chooseHybridRoute(
  prompt,
  {
    cloudConfigured = openAIConfigured(),
  } = {},
) {
  const override = parseHybridRouteOverride(prompt)
  if (override) {
    if (override.provider === 'openai' && !cloudConfigured) {
      return Object.freeze({
        provider: 'ollama',
        prompt: override.prompt,
        reason: 'cloud-unconfigured',
        explicit: true,
      })
    }
    return Object.freeze({
      ...override,
      reason:
        override.provider === 'openai'
          ? 'explicit-cloud'
          : 'explicit-local',
    })
  }

  const raw = String(prompt ?? '').trim()
  const text = normalize(raw)

  if (!cloudConfigured) {
    return Object.freeze({
      provider: 'ollama',
      prompt: raw,
      reason: 'cloud-unconfigured',
      explicit: false,
    })
  }

  if (LOCAL_HINTS.some((pattern) => pattern.test(text)) && raw.length < 180) {
    return Object.freeze({
      provider: 'ollama',
      prompt: raw,
      reason: 'simple-local-intent',
      explicit: false,
    })
  }

  let score = 0
  for (const pattern of CLOUD_HINTS) {
    if (pattern.test(text)) score += 1
  }

  if (raw.length >= 280) score += 1
  if ((raw.match(/[?¿]/g) ?? []).length >= 3) score += 1
  if ((raw.match(/\n/g) ?? []).length >= 4) score += 1

  if (score >= 2) {
    return Object.freeze({
      provider: 'openai',
      prompt: raw,
      reason: `complexity-score-${score}`,
      explicit: false,
    })
  }

  return Object.freeze({
    provider: 'ollama',
    prompt: raw,
    reason: `local-score-${score}`,
    explicit: false,
  })
}

export function attachHybridSession(socket) {
  const socketConversationId =
    `lumia-hybrid-${Date.now()}-${Math.random().toString(16).slice(2)}`
  let active = null
  let closed = false

  const send = (msg) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg))
    }
  }

  send({
    type: 'ready',
    servers: ['orbi_hybrid', 'ollama', 'openai'],
    provider: 'hybrid',
    modelName: `${getOllamaModel()} + ${OPENAI_MODEL}`,
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
    const originalPrompt = msg.text.trim()

    if (!originalPrompt) {
      send({ type: 'done', ask, text: '' })
      return
    }

    void (async () => {
      let answer = ''
      try {
        const voiceControl = parseVoiceRuntimeControl(originalPrompt)
        if (voiceControl) {
          send({
            type: 'tool',
            ask,
            name: 'orbi_voice_runtime_control',
          })
          const applied = applyVoiceRuntimeControl(voiceControl)
          answer = applied.answer

          if (closed || controller.signal.aborted) return

          appendConversationExchange(
            conversationId,
            originalPrompt,
            answer,
          )
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
            provider: 'hybrid',
            route: 'local-control',
            voiceControl: voiceControl.action,
            voiceChanged: applied.changed,
          })
          return
        }

        const route = chooseHybridRoute(originalPrompt)
        const history = getConversationHistory(conversationId)
        let actualProvider = route.provider
        let routeReason = route.reason
        let emittedCloudText = false

        if (route.provider === 'openai') {
          try {
            answer = await streamOpenAI({
              prompt: route.prompt,
              history:
                (
                  process.env.ORBIA_HYBRID_CLOUD_HISTORY === '0' ||
                  (
                    process.env.ORBIA_HYBRID_CLOUD_HISTORY == null &&
                    readBrainSettings().cloudHistory === false
                  )
                )
                  ? []
                  : history,
              systemPrompt: composeLumiaVoiceSystemPrompt({
                toolsEnabled: false,
                knowledgeEnabled: false,
              }),
              signal: controller.signal,
              onText: (delta) => {
                emittedCloudText = true
                send({
                  type: 'text',
                  ask,
                  delta,
                })
              },
            })
          } catch (error) {
            if (
              controller.signal.aborted ||
              closed ||
              emittedCloudText
            ) {
              throw error
            }

            actualProvider = 'ollama'
            routeReason = 'cloud-failed-local-fallback'
          }
        }

        if (actualProvider === 'ollama') {
          const knowledgeContext = buildKnowledgeContext(route.prompt)
          answer = await streamOllama({
            prompt: route.prompt,
            history,
            systemPrompt: composeLumiaVoiceSystemPrompt({
              toolsEnabled: false,
              knowledgeEnabled:
                knowledgeContext.entries.length > 0,
            }),
            knowledgeContext,
            toolContext: '',
            signal: controller.signal,
            onText: (delta) => send({
              type: 'text',
              ask,
              delta,
            }),
          })
        }

        if (closed || controller.signal.aborted) return

        appendConversationExchange(
          conversationId,
          originalPrompt,
          answer,
        )

        send({
          type: 'done',
          ask,
          conversationId,
          text: answer,
          provider: actualProvider,
          route: actualProvider,
          routeReason,
          modelName:
            actualProvider === 'openai'
              ? OPENAI_MODEL
              : getOllamaModel(),
        })
      } catch (error) {
        if (controller.signal.aborted || closed) return
        send({
          type: 'error',
          ask,
          message: `El router híbrido falló: ${String(error?.message ?? error)}`,
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
