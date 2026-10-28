import type { HeardLine, Turn } from '../store'

/** All times are measured at observation in the browser, in local wall time. */
const CLOCK = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})
const DATE = new Intl.DateTimeFormat('es-CL', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
})

export function timeLabel(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—'
  const t = new Date(ms)
  return `${CLOCK.format(t)}.${String(t.getMilliseconds()).padStart(3, '0')}`
}

export function dateLabel(ms: number): string {
  return DATE.format(new Date(ms))
}

export function elapsedLabel(start: number | undefined, end: number | undefined): string {
  if (!start || !end || end < start) return '—'
  const ms = end - start
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`
}

export function turnStateLabel(reply: Turn, now: number): string {
  const status = reply.status
  if (status === 'error') return 'ERROR'
  if (status === 'no-response') return 'SIN RESPUESTA'
  if (status === 'interrupted') return 'INTERRUMPIDA'
  if (status === 'complete') return 'COMPLETA'
  if (status === 'playing') return 'REPRODUCIENDO'
  if (status === 'generating') return 'GENERANDO'
  if ((status === 'pending' || !status) && reply.at && now - reply.at >= 15000) {
    return 'DEMORA · SIN TEXTO'
  }
  return 'ESPERANDO RESPUESTA'
}

/** A plain text clipboard report; no recordings, API keys or background upload. */
export function exportConversationTimeline({
  heard, turns, at, error, errorAt,
}: {
  heard: HeardLine[]
  turns: Turn[]
  at: number
  error?: string | null
  errorAt?: number | null
}): string {
  const lines = [`LUMIA · DIAGNÓSTICO DE CONVERSACIÓN · ${dateLabel(at)}`,
    'Reloj local del navegador. STT = procesamiento observado, no duración física del habla.',
    'TEXTO RECIBIDO (STT):']
  for (const item of heard) {
    lines.push(`[${timeLabel(item.at)}] ${item.mode}/${item.kind} (${item.provider})${item.sttMs == null ? '' : ` · STT ${item.sttMs} ms`}: ${item.text}`)
  }
  if (error) lines.push(`ERROR GENERAL [${timeLabel(errorAt)}]: ${error}`)
  lines.push('COMANDOS Y RESPUESTAS:')
  for (const t of turns) {
    if (t.role === 'user') {
      lines.push(`[${timeLabel(t.at)}] USUARIO: ${t.text}`)
    } else {
      lines.push(`[${timeLabel(t.at)}] LUMIA [${turnStateLabel(t, at)}]: ${t.text || '(sin texto)'}`)
      if (t.firstTextAt) lines.push(`  Primer texto: ${timeLabel(t.firstTextAt)} · espera ${elapsedLabel(t.at, t.firstTextAt)}`)
      if (t.firstAudioAt) lines.push(`  Reproducción iniciada: ${timeLabel(t.firstAudioAt)} · espera ${elapsedLabel(t.at, t.firstAudioAt)}`)
      for (const [index, segment] of (t.spokenSegments ?? []).entries()) {
        const parts = [
          `  Audio #${index + 1}: ${timeLabel(segment.at)}`,
          segment.gapMs === null ? null : `pausa previa ${segment.gapMs} ms`,
          segment.waitingTextMs === null ? null : `esperando texto del modelo ${segment.waitingTextMs} ms`,
          segment.waitingAudioMs === null ? null : `Kokoro/WAV ${segment.waitingAudioMs} ms`,
          segment.waitingPlaybackMs === null ? null : `Chrome/reproducción ${segment.waitingPlaybackMs} ms`,
        ].filter(Boolean)
        lines.push(`${parts.join(' · ')}: ${segment.text}`)
      }
      if (t.finishedAt) lines.push(`  Finalizado: ${timeLabel(t.finishedAt)} · total ${elapsedLabel(t.at, t.finishedAt)}`)
      if (t.errorNote) lines.push(`  Error: ${t.errorNote}`)
    }
  }
  return lines.join('\n')
}
