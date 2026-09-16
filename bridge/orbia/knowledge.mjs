/**
 * Bounded, controlled local knowledge for the C1 convergence runtime.
 *
 * Ported conceptually from the mature ORBI ChatBox IA Core Knowledge Engine:
 * deterministic local search, explicit provenance, max three context entries,
 * and a hard character budget. No network retrieval happens here.
 */

import { createKnowledgeContext } from './contracts.mjs'

export const MAX_CONTEXT_ENTRIES = 3
export const MAX_CONTEXT_CHARACTERS = 1200

export const ORBIA_KNOWLEDGE_ENTRIES = Object.freeze([
  Object.freeze({
    id: 'orbia-core-architecture',
    sourceType: 'local-static',
    domain: 'orbi',
    title: 'O.R.B.I.A. Core Architecture',
    content:
      'O.R.B.I.A. is the shared intelligence and orchestration core of ORBI Ecosystem. L.U.M.I.A. is its primary visible intelligent companion. Companion Mode, Studio Mode and future Widget Mode are interfaces over the same core, not separate assistants.',
    tags: Object.freeze(['orbia', 'core', 'architecture', 'companion', 'studio', 'widget']),
  }),
  Object.freeze({
    id: 'lumia-identity',
    sourceType: 'local-static',
    domain: 'orbi',
    title: 'L.U.M.I.A. Identity',
    content:
      'L.U.M.I.A. means Largely Useful Multitasking Intelligent Assistant. Her everyday spoken name is Lumi. She is the ORBI Intelligent Companion and the primary conversational presence of O.R.B.I.A.',
    tags: Object.freeze(['lumia', 'lumi', 'identity', 'assistant', 'companion']),
  }),
  Object.freeze({
    id: 'lumia-companion-mode',
    sourceType: 'local-static',
    domain: 'system',
    title: 'L.U.M.I.A. Companion Mode',
    content:
      'Companion Mode is the immersive holographic interface: avatar, reactor, HUD, voice interaction, contextual panels and blades. Its Visual V1 baseline is frozen while core convergence proceeds.',
    tags: Object.freeze(['companion', 'holographic', 'avatar', 'hud', 'voice', 'reactor']),
  }),
  Object.freeze({
    id: 'lumia-studio-mode',
    sourceType: 'local-static',
    domain: 'system',
    title: 'L.U.M.I.A. Studio Mode',
    content:
      'Studio Mode is the future deep-work interface evolved from ORBI ChatBox IA Core. It will expose chat, knowledge, projects, diagnostics, reports and other workspaces while sharing the same O.R.B.I.A. core and L.U.M.I.A. identity.',
    tags: Object.freeze(['studio', 'chatbox', 'workspace', 'knowledge', 'projects', 'reports']),
  }),
  Object.freeze({
    id: 'solar-mppt-basics',
    sourceType: 'local-static',
    domain: 'solar',
    title: 'MPPT en sistemas fotovoltaicos',
    content:
      'MPPT significa Maximum Power Point Tracking, o seguimiento del punto de máxima potencia. En un sistema fotovoltaico, el controlador o la etapa MPPT ajusta dinámicamente el punto eléctrico de operación de los módulos para extraer la mayor potencia disponible según irradiancia, temperatura y otras condiciones. No es un protocolo de comunicaciones.',
    tags: Object.freeze([
      'mppt',
      'solar',
      'fotovoltaico',
      'paneles',
      'inversor',
      'controlador',
      'maximum power point tracking',
    ]),
  }),
  Object.freeze({
    id: 'orbi-knowledge-boundary',
    sourceType: 'local-static',
    domain: 'system',
    title: 'Controlled ORBI Knowledge Boundary',
    content:
      'The local Knowledge Engine uses bounded controlled context. If supplied ORBI context does not support a specific claim, L.U.M.I.A. must say that the information is not available instead of inventing ORBI-specific facts.',
    tags: Object.freeze(['knowledge', 'grounding', 'boundary', 'controlled', 'orbi']),
  }),
])

export const normalizeKnowledgeQuery = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ.]+/gi, ' ').replace(/\s+/g, ' ').trim()

const tokensFor = (query) =>
  [...new Set(normalizeKnowledgeQuery(query).split(' ').filter((token) => token.length >= 3))].slice(0, 12)

const scoreEntry = (entry, normalizedQuery, tokens) => {
  const id = normalizeKnowledgeQuery(entry.id)
  const title = normalizeKnowledgeQuery(entry.title)
  const content = normalizeKnowledgeQuery(entry.content)
  const tags = entry.tags.map(normalizeKnowledgeQuery)
  let score = id === normalizedQuery ? 100 : 0

  for (const token of tokens) {
    if (title.includes(token)) score += 20
    if (tags.some((tag) => tag === token || tag.includes(token))) score += 15
    if (id.includes(token)) score += 10
    if (content.includes(token)) score += 5
  }

  return score
}

export function searchLocalKnowledge(query, limit = 10) {
  const normalizedQuery = normalizeKnowledgeQuery(query)
  if (!normalizedQuery) return Object.freeze([])
  const tokens = tokensFor(normalizedQuery)

  return Object.freeze(
    ORBIA_KNOWLEDGE_ENTRIES
      .map((entry) => Object.freeze({ entry, score: scoreEntry(entry, normalizedQuery, tokens) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
      .slice(0, Math.max(1, Math.min(10, Number(limit) || 3))),
  )
}

export function buildKnowledgeContext(query) {
  const matches = searchLocalKnowledge(query, 10)
  const entries = []
  let totalCharacters = 0
  let truncated = false

  for (const match of matches) {
    const entry = match.entry
    const characterCount = entry.title.length + entry.content.length

    if (
      entries.length >= MAX_CONTEXT_ENTRIES ||
      totalCharacters + characterCount > MAX_CONTEXT_CHARACTERS
    ) {
      truncated = true
      break
    }

    entries.push({
      id: entry.id,
      sourceType: entry.sourceType,
      domain: entry.domain,
      title: entry.title,
      content: entry.content,
      score: match.score,
    })
    totalCharacters += characterCount
  }

  const context = createKnowledgeContext({
    query: normalizeKnowledgeQuery(query),
    entries,
    source: 'local-static',
    truncated,
  })

  return Object.freeze({
    ...context,
    matchCount: matches.length,
    totalCharacters,
  })
}

export function knowledgeContextToPrompt(context) {
  if (!context?.entries?.length) return ''

  const lines = [
    'CONTEXTO ORBI CONTROLADO:',
    ...context.entries.map(
      (entry) => `[${entry.id}] ${entry.title}: ${entry.content}`,
    ),
    'Usa este contexto como fuente controlada para los temas que cubre. Para afirmaciones específicas de ORBI, no inventes detalles que no estén respaldados aquí.',
  ]

  return lines.join('\n')
}
