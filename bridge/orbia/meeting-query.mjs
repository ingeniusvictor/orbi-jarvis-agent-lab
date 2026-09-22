/**
 * Query-the-meeting.
 *
 * Retrieval is deterministic and local. Only the most relevant transcript
 * evidence is sent to the local Ollama model, keeping long meetings bounded.
 */

import {
  OLLAMA_KEEP_ALIVE,
  OLLAMA_URL,
  getOllamaModel,
} from '../ollama.mjs'
import { meetingTurnsToText } from './meeting-intelligence.mjs'

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokens = (value) =>
  [...new Set(normalize(value).split(' ').filter((x) => x.length >= 3))]

export function selectMeetingEvidence(question, turns = [], limit = 24) {
  const q = normalize(question)
  const qTokens = tokens(q)

  const scored = turns.map((turn, index) => {
    const text = normalize(turn.text)
    const speaker = normalize(turn.speakerName)
    let score = 0

    for (const token of qTokens) {
      if (text.includes(token)) score += 5
      if (speaker.includes(token)) score += 8
    }

    if (q && text.includes(q)) score += 20
    if (turn.markedImportant) score += 2

    return { turn, index, score }
  })

  const hits = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 24)))

  // If lexical retrieval finds nothing, use a bounded tail: recent decisions
  // are often what a follow-up question refers to.
  const selected = hits.length
    ? hits.map((x) => x.turn)
    : turns.slice(-Math.max(1, Math.min(12, Number(limit) || 12)))

  selected.sort(
    (a, b) =>
      (Number(a.startedAtMs) || 0) - (Number(b.startedAtMs) || 0),
  )
  return Object.freeze(selected)
}

const QUERY_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    answer: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestampMs: { type: ['number', 'null'] },
          speaker: { type: ['string', 'null'] },
          note: { type: 'string' },
        },
        required: ['timestampMs', 'speaker', 'note'],
      },
    },
    supported: { type: 'boolean' },
  },
  required: ['answer', 'evidence', 'supported'],
})

export async function answerMeetingQuestion(
  question,
  turns,
  { env = process.env } = {},
) {
  const evidence = selectMeetingEvidence(question, turns)
  if (!evidence.length) {
    return Object.freeze({
      answer: 'No hay transcripción disponible para responder esa pregunta.',
      evidence: Object.freeze([]),
      supported: false,
    })
  }

  const url = (env.JARVIS_OLLAMA_URL ?? OLLAMA_URL).replace(/\/+$/, '')
  const model = env.ORBIA_MEETING_MODEL?.trim() || getOllamaModel()

  const res = await fetch(url + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      format: QUERY_SCHEMA,
      options: { temperature: 0, num_predict: 600 },
      messages: [
        {
          role: 'system',
          content:
            'Responde preguntas sobre una reunión usando únicamente la evidencia proporcionada. ' +
            'Si la evidencia no basta, supported debe ser false y debes decirlo claramente. ' +
            'No inventes nombres, decisiones, tareas ni fechas. Responde en español latinoamericano.',
        },
        {
          role: 'user',
          content:
            'PREGUNTA:\n' +
            String(question ?? '').trim() +
            '\n\nEVIDENCIA DE TRANSCRIPCIÓN:\n' +
            meetingTurnsToText(evidence),
        },
      ],
    }),
    signal: AbortSignal.timeout(
      Math.max(20_000, Number(env.ORBIA_MEETING_QUERY_TIMEOUT_MS) || 90_000),
    ),
  })

  if (!res.ok) throw new Error('meeting query model unavailable')
  const data = await res.json()
  const parsed = JSON.parse(String(data?.message?.content ?? '{}'))

  return Object.freeze({
    answer: String(parsed.answer ?? '').trim(),
    evidence: Object.freeze(
      Array.isArray(parsed.evidence) ? parsed.evidence : [],
    ),
    supported: Boolean(parsed.supported),
  })
}
