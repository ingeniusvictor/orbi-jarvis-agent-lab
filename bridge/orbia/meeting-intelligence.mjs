/**
 * L.U.M.I.A. Meeting Intelligence — local-first structured analysis.
 *
 * Transcription never depends on this module. It consumes already-durable
 * meeting turns and generates regenerable structured intelligence via Ollama.
 */

import {
  OLLAMA_KEEP_ALIVE,
  OLLAMA_URL,
  getOllamaModel,
} from '../ollama.mjs'

const CHUNK_CHARS = 8000

export const MEETING_INTELLIGENCE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    summary: { type: 'string' },
    topics: { type: 'array', items: { type: 'string' } },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          decision: { type: 'string' },
          owner: { type: ['string', 'null'] },
          timestampMs: { type: ['number', 'null'] },
        },
        required: ['decision', 'owner', 'timestampMs'],
      },
    },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          owner: { type: ['string', 'null'] },
          due: { type: ['string', 'null'] },
          accepted: { type: ['boolean', 'null'] },
          timestampMs: { type: ['number', 'null'] },
        },
        required: ['task', 'owner', 'due', 'accepted', 'timestampMs'],
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' } },
    importantMoments: {
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
  },
  required: [
    'summary',
    'topics',
    'decisions',
    'actionItems',
    'openQuestions',
    'importantMoments',
  ],
})

const formatTimestamp = (ms) => {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function meetingTurnsToText(turns = []) {
  return turns
    .map(
      (turn) =>
        '[' +
        formatTimestamp(turn.startedAtMs) +
        '] ' +
        String(turn.speakerName || 'Unknown speaker') +
        ': ' +
        String(turn.text || '').trim(),
    )
    .filter((line) => !line.endsWith(': '))
    .join('\n')
}

export function chunkMeetingTurns(turns = [], maxChars = CHUNK_CHARS) {
  const chunks = []
  let current = []
  let chars = 0

  for (const turn of turns) {
    const rendered = meetingTurnsToText([turn])
    const cost = rendered.length + 1
    if (current.length && chars + cost > maxChars) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(turn)
    chars += cost
  }
  if (current.length) chunks.push(current)
  return Object.freeze(chunks.map((chunk) => Object.freeze(chunk)))
}

function emptyIntelligence() {
  return {
    summary: '',
    topics: [],
    decisions: [],
    actionItems: [],
    openQuestions: [],
    importantMoments: [],
  }
}

function normalizeIntelligence(value) {
  const src = value && typeof value === 'object' ? value : {}
  const array = (name) => (Array.isArray(src[name]) ? src[name] : [])
  return Object.freeze({
    summary: String(src.summary ?? '').trim(),
    topics: Object.freeze(array('topics')),
    decisions: Object.freeze(array('decisions')),
    actionItems: Object.freeze(array('actionItems')),
    openQuestions: Object.freeze(array('openQuestions')),
    importantMoments: Object.freeze(array('importantMoments')),
  })
}

async function askOllamaStructured(prompt, { env = process.env } = {}) {
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
      format: MEETING_INTELLIGENCE_SCHEMA,
      options: {
        temperature: 0.1,
        num_predict: 1400,
      },
      messages: [
        {
          role: 'system',
          content:
            'Eres el analizador local de reuniones de L.U.M.I.A. ' +
            'Extrae únicamente hechos respaldados por la transcripción. ' +
            'No inventes responsables, fechas ni decisiones. ' +
            'Conserva nombres de participantes exactamente como aparecen. ' +
            'Escribe en español latinoamericano claro y profesional.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(
      Math.max(30_000, Number(env.ORBIA_MEETING_ANALYSIS_TIMEOUT_MS) || 180_000),
    ),
  })

  if (!res.ok) throw new Error('meeting intelligence model unavailable')
  const data = await res.json()
  const content = String(data?.message?.content ?? '').trim()
  if (!content) throw new Error('meeting intelligence returned empty content')
  return normalizeIntelligence(JSON.parse(content))
}

export function buildMeetingAnalysisPrompt({
  title = 'Reunión',
  participants = [],
  transcript = '',
  previousSummaries = [],
  finalPass = false,
} = {}) {
  const people = participants
    .map((participant) => participant.displayName || participant.name)
    .filter(Boolean)
    .join(', ')

  return [
    'TÍTULO: ' + title,
    'PARTICIPANTES CONOCIDOS: ' + (people || 'no disponibles'),
    finalPass
      ? 'FASE: consolidación final de análisis parciales.'
      : 'FASE: análisis de un segmento de la reunión.',
    previousSummaries.length
      ? 'ANÁLISIS PARCIALES PREVIOS:\n' +
        previousSummaries.map((x, i) => '--- ' + (i + 1) + ' ---\n' + x).join('\n')
      : '',
    transcript ? 'TRANSCRIPCIÓN:\n' + transcript : '',
    'Devuelve resumen, temas, decisiones explícitas, tareas/compromisos, preguntas pendientes y momentos importantes.',
    'Una tarea solo existe si la conversación expresa una acción pendiente o compromiso.',
    'accepted debe ser true solo si la persona responsable aceptó explícitamente la tarea.',
    'timestampMs debe apuntar al momento relevante cuando esté disponible.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function generateMeetingIntelligence(
  {
    title = 'Reunión',
    participants = [],
    turns = [],
  } = {},
  options = {},
) {
  if (!turns.length) return Object.freeze(emptyIntelligence())

  const chunks = chunkMeetingTurns(turns)
  const partials = []

  for (const chunk of chunks) {
    partials.push(
      await askOllamaStructured(
        buildMeetingAnalysisPrompt({
          title,
          participants,
          transcript: meetingTurnsToText(chunk),
        }),
        options,
      ),
    )
  }

  if (partials.length === 1) return partials[0]

  const packed = partials.map((partial) => JSON.stringify(partial))
  return askOllamaStructured(
    buildMeetingAnalysisPrompt({
      title,
      participants,
      previousSummaries: packed,
      finalPass: true,
    }),
    options,
  )
}
