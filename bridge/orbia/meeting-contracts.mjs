/**
 * L.U.M.I.A. Meeting Intelligence contracts.
 *
 * These records are provider-neutral. Teams, Zoom, Meet, microphone-only and
 * future ORBI Edge Mesh sources all converge on the same durable meeting log.
 */

export const MEETING_STATES = Object.freeze([
  'recording',
  'paused',
  'ended',
])

export const MEETING_SOURCES = Object.freeze([
  'microphone',
  'system-audio',
  'platform-caption',
  'platform-transcript',
  'diarization',
  'manual',
])

export const SPEAKER_IDENTITY_SOURCES = Object.freeze([
  'platform',
  'local-speaker-profile',
  'manual',
  'diarization',
  'anonymous',
])

const clean = (value, max = 500) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export function normalizeParticipant(input = {}) {
  const displayName = clean(input.displayName, 160)
  const platformId = clean(input.platformId, 240)
  const stableId =
    clean(input.id, 240) ||
    platformId ||
    (displayName
      ? 'name:' + displayName.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, '-')
      : '')

  if (!stableId) throw new Error('participant id or displayName is required')

  return Object.freeze({
    id: stableId,
    displayName: displayName || 'Unknown participant',
    platformId: platformId || null,
    platform: clean(input.platform, 40) || null,
    role: clean(input.role, 80) || null,
    isLocalUser: Boolean(input.isLocalUser),
  })
}

export function normalizeMeetingUtterance(input = {}) {
  const text = clean(input.text, 20_000)
  if (!text) throw new Error('utterance text is required')

  const startedAtMs = Math.max(0, Number(input.startedAtMs) || 0)
  const endedAtMs = Math.max(startedAtMs, Number(input.endedAtMs) || startedAtMs)

  const source = MEETING_SOURCES.includes(input.source)
    ? input.source
    : 'manual'

  return Object.freeze({
    id:
      clean(input.id, 180) ||
      'utt-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 10),
    startedAtMs,
    endedAtMs,
    speakerId: clean(input.speakerId, 240) || null,
    speakerName: clean(input.speakerName, 160) || 'Unknown speaker',
    speakerIdentitySource:
      SPEAKER_IDENTITY_SOURCES.includes(input.speakerIdentitySource)
        ? input.speakerIdentitySource
        : 'anonymous',
    speakerConfidence:
      Number.isFinite(Number(input.speakerConfidence))
        ? Math.max(0, Math.min(1, Number(input.speakerConfidence)))
        : null,
    source,
    platform: clean(input.platform, 40) || null,
    text,
    language: clean(input.language, 20) || null,
    final: input.final !== false,
    markedImportant: Boolean(input.markedImportant),
    receivedAt: new Date().toISOString(),
  })
}
