/**
 * Meeting artifact renderers.
 *
 * Pure transformations: safe to regenerate from transcript/intelligence at any
 * time without touching the original JSONL evidence.
 */

const pad = (n, w = 2) => String(n).padStart(w, '0')

export function meetingTimestamp(ms, separator = '.') {
  const totalMs = Math.max(0, Math.round(Number(ms) || 0))
  const h = Math.floor(totalMs / 3_600_000)
  const m = Math.floor((totalMs % 3_600_000) / 60_000)
  const s = Math.floor((totalMs % 60_000) / 1000)
  const milli = totalMs % 1000
  return pad(h) + ':' + pad(m) + ':' + pad(s) + separator + pad(milli, 3)
}

export function renderMeetingMarkdown({
  metadata = {},
  participants = [],
  turns = [],
} = {}) {
  const out = [
    '# ' + (metadata.title || 'Reunión'),
    '',
    '- Plataforma: ' + (metadata.platform || 'generic'),
    '- Inicio: ' + (metadata.createdAt || ''),
    '- Fin: ' + (metadata.endedAt || 'en curso'),
    '',
    '## Participantes',
    '',
    ...(participants.length
      ? participants.map((p) => '- ' + (p.displayName || p.name || 'Unknown participant'))
      : ['- No disponibles']),
    '',
    '## Transcripción',
    '',
  ]

  for (const turn of turns) {
    out.push(
      '**[' +
        meetingTimestamp(turn.startedAtMs, '.').slice(0, 8) +
        '] ' +
        (turn.speakerName || 'Unknown speaker') +
        '**',
    )
    out.push('')
    out.push(String(turn.text || '').trim())
    out.push('')
  }

  return out.join('\n').trim() + '\n'
}

export function renderMeetingVtt(turns = []) {
  const out = ['WEBVTT', '']
  for (const turn of turns) {
    out.push(
      meetingTimestamp(turn.startedAtMs) +
        ' --> ' +
        meetingTimestamp(turn.endedAtMs),
    )
    const name = String(turn.speakerName || 'Unknown speaker').replace(/[<>]/g, '')
    out.push('<v ' + name + '>' + String(turn.text || '').replace(/\s+/g, ' ').trim() + '</v>')
    out.push('')
  }
  return out.join('\n')
}

export function renderMeetingSummaryMarkdown(intelligence = {}) {
  const lines = [
    '# Resumen de reunión',
    '',
    String(intelligence.summary || 'Sin resumen disponible.'),
    '',
    '## Temas',
    '',
    ...(intelligence.topics?.length
      ? intelligence.topics.map((x) => '- ' + x)
      : ['- Ninguno identificado']),
    '',
    '## Decisiones',
    '',
    ...(intelligence.decisions?.length
      ? intelligence.decisions.map(
          (x) =>
            '- ' +
            x.decision +
            (x.owner ? ' — Responsable: ' + x.owner : ''),
        )
      : ['- Ninguna decisión explícita identificada']),
    '',
    '## Tareas',
    '',
    ...(intelligence.actionItems?.length
      ? intelligence.actionItems.map(
          (x) =>
            '- [ ] ' +
            x.task +
            (x.owner ? ' — ' + x.owner : '') +
            (x.due ? ' — ' + x.due : ''),
        )
      : ['- Ninguna tarea explícita identificada']),
    '',
    '## Preguntas pendientes',
    '',
    ...(intelligence.openQuestions?.length
      ? intelligence.openQuestions.map((x) => '- ' + x)
      : ['- Ninguna identificada']),
    '',
  ]
  return lines.join('\n')
}
