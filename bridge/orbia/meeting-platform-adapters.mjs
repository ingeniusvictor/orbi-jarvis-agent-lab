/**
 * Platform event adapters for Meeting Intelligence.
 *
 * Live platform integrations feed explicit participant/caption events here.
 * The adapter never guesses a name from screen position, avatar colour or DOM
 * order. Unknown identity remains unknown until better evidence arrives.
 */

export function normalizePlatformParticipantEvent(event = {}) {
  const platform = String(event.platform ?? 'generic').trim().toLowerCase()
  const displayName = String(event.displayName ?? '').replace(/\s+/g, ' ').trim()
  const platformId = String(event.platformId ?? '').trim()

  if (!displayName && !platformId) {
    throw new Error('platform participant identity is required')
  }

  return Object.freeze({
    type: 'participant',
    platform,
    platformId: platformId || null,
    displayName: displayName || 'Unknown participant',
    role: String(event.role ?? '').trim() || null,
    isLocalUser: Boolean(event.isLocalUser),
  })
}

export function normalizePlatformCaptionEvent(event = {}) {
  const platform = String(event.platform ?? 'generic').trim().toLowerCase()
  const text = String(event.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('platform caption text is required')

  const speakerName = String(event.speakerName ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const speakerId = String(event.speakerId ?? '').trim()

  return Object.freeze({
    type: 'caption',
    platform,
    text,
    startedAtMs: Math.max(0, Number(event.startedAtMs) || 0),
    endedAtMs: Math.max(
      Math.max(0, Number(event.startedAtMs) || 0),
      Number(event.endedAtMs) || Number(event.startedAtMs) || 0,
    ),
    platformSpeakerId: speakerId || null,
    platformSpeakerName: speakerName || null,
    source: 'platform-caption',
    final: event.final !== false,
  })
}

export function platformIdentityPolicy() {
  return Object.freeze({
    useExplicitPlatformIdentity: true,
    inferIdentityFromDomOrder: false,
    inferIdentityFromAvatar: false,
    inferIdentityFromScreenPosition: false,
    unknownFallsBackToDiarization: true,
  })
}
