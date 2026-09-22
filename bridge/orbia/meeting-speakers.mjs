/**
 * Meeting speaker identity resolver.
 *
 * Identity is evidence-fused, not guessed. Platform-provided display names are
 * preferred for online meetings. The local enrolled user can be recognized by
 * speaker verification. Anonymous diarization remains the fallback.
 */

const rank = Object.freeze({
  platform: 100,
  manual: 95,
  'local-speaker-profile': 90,
  diarization: 40,
  anonymous: 0,
})

const clean = (value, max = 200) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export function speakerCandidate({
  id = null,
  name = null,
  source = 'anonymous',
  confidence = null,
} = {}) {
  const normalizedSource =
    Object.prototype.hasOwnProperty.call(rank, source)
      ? source
      : 'anonymous'
  return Object.freeze({
    id: clean(id, 240) || null,
    name: clean(name, 160) || null,
    source: normalizedSource,
    confidence:
      Number.isFinite(Number(confidence))
        ? Math.max(0, Math.min(1, Number(confidence)))
        : null,
    rank: rank[normalizedSource],
  })
}

export function resolveSpeakerIdentity(candidates = []) {
  const usable = candidates
    .filter(Boolean)
    .map((candidate) => speakerCandidate(candidate))
    .filter((candidate) => candidate.name || candidate.id)

  if (!usable.length) {
    return Object.freeze({
      id: null,
      name: 'Unknown speaker',
      source: 'anonymous',
      confidence: null,
    })
  }

  usable.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank
    return (b.confidence ?? -1) - (a.confidence ?? -1)
  })

  const best = usable[0]
  return Object.freeze({
    id: best.id,
    name:
      best.name ||
      (best.source === 'diarization' && best.id
        ? best.id
        : 'Unknown speaker'),
    source: best.source,
    confidence: best.confidence,
  })
}

export function anonymousDiarizationSpeaker(index) {
  const n = Math.max(0, Number(index) || 0) + 1
  return speakerCandidate({
    id: 'speaker-' + n,
    name: 'SPEAKER ' + n,
    source: 'diarization',
    confidence: null,
  })
}
