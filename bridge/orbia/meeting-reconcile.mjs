/**
 * Meeting transcript reconciliation.
 *
 * Raw local transcription is immutable evidence. Platform transcripts are a
 * second evidence source. This module produces a canonical view without
 * deleting either source.
 */

const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const words = (value) => new Set(norm(value).split(' ').filter((w) => w.length >= 2))

export function textSimilarity(a, b) {
  const aa = words(a)
  const bb = words(b)
  if (!aa.size || !bb.size) return 0
  let overlap = 0
  for (const word of aa) if (bb.has(word)) overlap++
  return overlap / Math.max(aa.size, bb.size)
}

export function temporalOverlap(a, b) {
  const a0 = Number(a?.startedAtMs) || 0
  const a1 = Number(a?.endedAtMs) || a0
  const b0 = Number(b?.startedAtMs) || 0
  const b1 = Number(b?.endedAtMs) || b0
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
  const span = Math.max(1, Math.max(a1, b1) - Math.min(a0, b0))
  return overlap / span
}

function scoreMatch(local, platform) {
  const temporal = temporalOverlap(local, platform)
  const text = textSimilarity(local?.text, platform?.text)
  const midpointA =
    ((Number(local?.startedAtMs) || 0) + (Number(local?.endedAtMs) || 0)) / 2
  const midpointB =
    ((Number(platform?.startedAtMs) || 0) + (Number(platform?.endedAtMs) || 0)) / 2
  const distance = Math.abs(midpointA - midpointB)
  const proximity = Math.max(0, 1 - distance / 5000)
  return temporal * 0.5 + text * 0.35 + proximity * 0.15
}

export function reconcileMeetingTurns(localTurns = [], platformTurns = []) {
  const usedPlatform = new Set()
  const canonical = []

  for (const local of localTurns) {
    let bestIndex = -1
    let bestScore = 0

    for (let i = 0; i < platformTurns.length; i++) {
      if (usedPlatform.has(i)) continue
      const score = scoreMatch(local, platformTurns[i])
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.35) {
      const platform = platformTurns[bestIndex]
      usedPlatform.add(bestIndex)
      canonical.push(
        Object.freeze({
          ...local,
          speakerId:
            platform.speakerId || local.speakerId || null,
          speakerName:
            platform.speakerName &&
            platform.speakerName !== 'Unknown speaker'
              ? platform.speakerName
              : local.speakerName,
          speakerIdentitySource:
            platform.speakerIdentitySource === 'platform'
              ? 'platform'
              : local.speakerIdentitySource,
          speakerConfidence:
            platform.speakerIdentitySource === 'platform'
              ? 1
              : local.speakerConfidence,
          platformText: platform.text,
          reconciliationScore: Number(bestScore.toFixed(4)),
          reconciled: true,
        }),
      )
      continue
    }

    canonical.push(
      Object.freeze({
        ...local,
        reconciliationScore: null,
        reconciled: false,
      }),
    )
  }

  for (let i = 0; i < platformTurns.length; i++) {
    if (usedPlatform.has(i)) continue
    canonical.push(
      Object.freeze({
        ...platformTurns[i],
        reconciliationScore: null,
        reconciled: false,
        platformOnly: true,
      }),
    )
  }

  canonical.sort(
    (a, b) =>
      (Number(a.startedAtMs) || 0) - (Number(b.startedAtMs) || 0),
  )
  return Object.freeze(canonical)
}
