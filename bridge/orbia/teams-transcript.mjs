/**
 * Microsoft Teams transcript adapter.
 *
 * Parses speaker-attributed WebVTT returned by Microsoft Graph and converts it
 * into canonical L.U.M.I.A. meeting utterances. No Graph credentials live here;
 * transport/auth is deliberately separate from transcript interpretation.
 */

import { resolveSpeakerIdentity } from './meeting-speakers.mjs'

const timeMs = (value) => {
  const raw = String(value ?? '').trim().replace(',', '.')
  const parts = raw.split(':')
  if (parts.length < 2 || parts.length > 3) return null

  const seconds = Number(parts.pop())
  const minutes = Number(parts.pop())
  const hours = parts.length ? Number(parts.pop()) : 0
  if (![hours, minutes, seconds].every(Number.isFinite)) return null
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000)
}

const decodeEntities = (value) =>
  String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const stripVttMarkup = (value) =>
  decodeEntities(
    String(value ?? '')
      .replace(/<v(?:\.[^ >]+)?\s+[^>]+>/gi, '')
      .replace(/<\/v>/gi, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()

const speakerFromPayload = (payload) => {
  const match = String(payload ?? '').match(/<v(?:\.[^ >]+)?\s+([^>]+)>/i)
  return match?.[1]?.trim() || null
}

export function parseTeamsTranscriptVtt(vtt) {
  const normalized = String(vtt ?? '').replace(/\r\n/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const turns = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trimEnd())
    if (!lines.length) continue
    if (lines[0].startsWith('WEBVTT')) continue
    if (lines[0].startsWith('NOTE')) continue

    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue

    const timing = lines[timingIndex].match(
      /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/,
    )
    if (!timing) continue

    const startedAtMs = timeMs(timing[1])
    const endedAtMs = timeMs(timing[2])
    if (startedAtMs == null || endedAtMs == null) continue

    const payload = lines.slice(timingIndex + 1).join(' ').trim()
    const speakerName = speakerFromPayload(payload)
    const text = stripVttMarkup(payload)
    if (!text) continue

    const identity = resolveSpeakerIdentity([
      speakerName
        ? {
            id: 'teams-name:' + speakerName.toLowerCase(),
            name: speakerName,
            source: 'platform',
            confidence: 1,
          }
        : null,
    ])

    turns.push(
      Object.freeze({
        startedAtMs,
        endedAtMs,
        speakerId: identity.id,
        speakerName: identity.name,
        speakerIdentitySource: identity.source,
        speakerConfidence: identity.confidence,
        source: 'platform-transcript',
        platform: 'teams',
        text,
        language: null,
        final: true,
      }),
    )
  }

  return Object.freeze(turns)
}

export function teamsTranscriptCapabilities() {
  return Object.freeze({
    platform: 'teams',
    liveGraphTranscript: false,
    postMeetingGraphTranscript: true,
    speakerAttributionWhenTenantAllows: true,
    canonicalFormat: 'text/vtt',
  })
}
