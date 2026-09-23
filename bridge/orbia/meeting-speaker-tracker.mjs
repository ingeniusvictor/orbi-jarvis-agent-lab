/**
 * MI-04 Persistent Speaker Tracking for room meetings.
 *
 * Anonymous participant embeddings exist only in process memory for the active
 * meeting. MI-04 extends adaptive matching with conservative short-turn
 * recovery while keeping anonymous embeddings process-memory only.
 */

import {
  averageSpeakerEmbeddings,
  computeSpeakerEmbedding,
  cosineSimilarity,
  loadSpeakerProfile,
} from './speaker-verification.mjs'
import {
  decodeMonoPcm16Wav,
  diarizeLocalWav,
} from './speaker-diarization.mjs'
import {
  encodeMonoPcm16Wav,
  mergeSpeakerSegments,
  sliceSpeakerSegment,
} from './multivoice-stt.mjs'
import { transcribeLocalWav } from './local-stt.mjs'

const DEFAULT_TRACK_THRESHOLD = 0.58
const DEFAULT_SOFT_THRESHOLD = 0.42
const DEFAULT_SHORT_MATCH_THRESHOLD = 0.32
const DEFAULT_MERGE_THRESHOLD = 0.64
const DEFAULT_PRIMARY_THRESHOLD = 0.60
const MAX_EMBED_SECONDS = 9.5
const MIN_EMBED_SECONDS = 0.85
const MIN_SHORT_EMBED_SECONDS = 0.45

const MEETING_SAMPLE_POLICY = Object.freeze({
  minSeconds: MIN_EMBED_SECONDS,
  maxSeconds: 10,
  minRms: 0.004,
  minPeak: 0.015,
})

const MEETING_SHORT_SAMPLE_POLICY = Object.freeze({
  minSeconds: MIN_SHORT_EMBED_SECONDS,
  maxSeconds: 10,
  minRms: 0.004,
  minPeak: 0.015,
})

const clampThreshold = (value, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(-1, Math.min(1, n))
}

const normalizeExpectedParticipants = (value) => {
  if (value == null || value === '') return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.min(20, n))
}

function trackerThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_MEETING_SPEAKER_TRACK_THRESHOLD,
    DEFAULT_TRACK_THRESHOLD,
  )
}

function trackerSoftThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_MEETING_SPEAKER_SOFT_THRESHOLD,
    DEFAULT_SOFT_THRESHOLD,
  )
}

function trackerShortMatchThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_MEETING_SPEAKER_SHORT_MATCH_THRESHOLD,
    DEFAULT_SHORT_MATCH_THRESHOLD,
  )
}

function trackerMergeThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_MEETING_SPEAKER_MERGE_THRESHOLD,
    DEFAULT_MERGE_THRESHOLD,
  )
}

function primaryThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_SPEAKER_VERIFY_THRESHOLD,
    DEFAULT_PRIMARY_THRESHOLD,
  )
}

function weightedCentroid(current, currentCount, next) {
  if (!current || currentCount <= 0) return Object.freeze(Array.from(next))
  const repeated = []
  const copies = Math.max(1, Math.min(8, Number(currentCount) || 1))
  for (let i = 0; i < copies; i++) repeated.push(current)
  repeated.push(next)
  return averageSpeakerEmbeddings(repeated)
}

function mergedCentroid(a, aCount, b, bCount) {
  const vectors = []
  const aCopies = Math.max(1, Math.min(8, Number(aCount) || 1))
  const bCopies = Math.max(1, Math.min(8, Number(bCount) || 1))
  for (let i = 0; i < aCopies; i++) vectors.push(a)
  for (let i = 0; i < bCopies; i++) vectors.push(b)
  return averageSpeakerEmbeddings(vectors)
}

export class PersistentMeetingSpeakerTracker {
  constructor({
    threshold = DEFAULT_TRACK_THRESHOLD,
    softThreshold = DEFAULT_SOFT_THRESHOLD,
    shortMatchThreshold = DEFAULT_SHORT_MATCH_THRESHOLD,
    mergeThreshold = DEFAULT_MERGE_THRESHOLD,
    expectedParticipants = null,
    primaryProfile = null,
    primaryName = 'LOCAL USER',
    primaryMatchThreshold = DEFAULT_PRIMARY_THRESHOLD,
  } = {}) {
    this.threshold = clampThreshold(threshold, DEFAULT_TRACK_THRESHOLD)
    this.softThreshold = clampThreshold(
      softThreshold,
      DEFAULT_SOFT_THRESHOLD,
    )
    this.shortMatchThreshold = clampThreshold(
      shortMatchThreshold,
      DEFAULT_SHORT_MATCH_THRESHOLD,
    )
    this.mergeThreshold = clampThreshold(
      mergeThreshold,
      DEFAULT_MERGE_THRESHOLD,
    )
    this.expectedParticipants =
      normalizeExpectedParticipants(expectedParticipants)
    this.primaryProfile = primaryProfile
    this.primaryName = String(primaryName || 'LOCAL USER').trim() || 'LOCAL USER'
    this.primaryMatchThreshold = clampThreshold(
      primaryMatchThreshold,
      DEFAULT_PRIMARY_THRESHOLD,
    )
    this.speakers = []
    this.aliases = new Map()
    this.merges = []
    this.nextSpeaker = 1
    this.lastDecision = null
    this.shortRecoveryCount = 0
  }

  setExpectedParticipants(value) {
    const normalized = normalizeExpectedParticipants(value)
    if (normalized != null) this.expectedParticipants = normalized
    return this.expectedParticipants
  }

  anonymousLimit() {
    if (!this.expectedParticipants) return null
    return Math.max(
      0,
      this.expectedParticipants -
        (this.primaryProfile?.embedding?.length ? 1 : 0),
    )
  }

  resolveSpeakerId(id) {
    let current = id
    const seen = new Set()
    while (current && this.aliases.has(current) && !seen.has(current)) {
      seen.add(current)
      current = this.aliases.get(current)
    }
    return current
  }

  speakerById(id) {
    const canonical = this.resolveSpeakerId(id)
    return this.speakers.find((speaker) => speaker.id === canonical) ?? null
  }

  identityFor(id) {
    if (id === 'local-primary') {
      return Object.freeze({
        id,
        name: this.primaryName,
        source: 'local-speaker-profile',
      })
    }
    const speaker = this.speakerById(id)
    if (!speaker) return null
    return Object.freeze({
      id: speaker.id,
      name: speaker.name,
      source: 'diarization',
    })
  }

  updateSpeaker(speaker, vector, atMs, score, reason) {
    speaker.centroid = weightedCentroid(
      speaker.centroid,
      speaker.sampleCount,
      vector,
    )
    speaker.sampleCount += 1
    speaker.lastSeenAtMs = Math.max(
      speaker.lastSeenAtMs,
      Number(atMs) || 0,
    )
    this.lastDecision = {
      action: reason,
      speakerId: speaker.id,
      score: Number.isFinite(score) ? score : null,
      atMs: Math.max(0, Number(atMs) || 0),
    }
    this.consolidateDuplicates()
    const canonical = this.speakerById(speaker.id) ?? speaker
    return Object.freeze({
      id: canonical.id,
      name: canonical.name,
      source: 'diarization',
      confidence: score,
      newSpeaker: false,
      reason,
    })
  }

  reuseSpeakerWithoutCentroidUpdate(
    speaker,
    atMs,
    score,
    reason = 'short-turn-recovery',
  ) {
    speaker.lastSeenAtMs = Math.max(
      speaker.lastSeenAtMs,
      Number(atMs) || 0,
    )
    this.shortRecoveryCount += 1
    this.lastDecision = {
      action: reason,
      speakerId: speaker.id,
      score: Number.isFinite(score) ? score : null,
      atMs: Math.max(0, Number(atMs) || 0),
    }
    return Object.freeze({
      id: speaker.id,
      name: speaker.name,
      source: 'diarization-short-recovery',
      confidence: score,
      newSpeaker: false,
      reason,
    })
  }

  consolidateDuplicates() {
    let changed = true
    while (changed) {
      changed = false
      let best = null

      for (let i = 0; i < this.speakers.length; i++) {
        for (let j = i + 1; j < this.speakers.length; j++) {
          const left = this.speakers[i]
          const right = this.speakers[j]
          if (left.sampleCount + right.sampleCount < 3) continue

          const score = cosineSimilarity(left.centroid, right.centroid)
          if (score < this.mergeThreshold) continue
          if (!best || score > best.score) {
            best = { left, right, score }
          }
        }
      }

      if (!best) break

      const keep =
        best.left.firstSeenAtMs <= best.right.firstSeenAtMs
          ? best.left
          : best.right
      const drop = keep === best.left ? best.right : best.left

      keep.centroid = mergedCentroid(
        keep.centroid,
        keep.sampleCount,
        drop.centroid,
        drop.sampleCount,
      )
      keep.sampleCount += drop.sampleCount
      keep.firstSeenAtMs = Math.min(
        keep.firstSeenAtMs,
        drop.firstSeenAtMs,
      )
      keep.lastSeenAtMs = Math.max(
        keep.lastSeenAtMs,
        drop.lastSeenAtMs,
      )

      this.aliases.set(drop.id, keep.id)
      for (const [from, to] of this.aliases) {
        if (to === drop.id) this.aliases.set(from, keep.id)
      }
      this.merges.push(
        Object.freeze({
          from: drop.id,
          to: keep.id,
          score: best.score,
        }),
      )
      this.speakers = this.speakers.filter(
        (speaker) => speaker.id !== drop.id,
      )
      changed = true
    }
  }

  assignEmbedding(
    embedding,
    {
      atMs = 0,
      evidenceQuality = 'normal',
    } = {},
  ) {
    const vector = Array.from(embedding ?? [], Number)
    if (!vector.length) {
      return Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: null,
        newSpeaker: false,
        reason: 'embedding-missing',
      })
    }

    if (this.primaryProfile?.embedding?.length) {
      const score = cosineSimilarity(this.primaryProfile.embedding, vector)
      if (score >= this.primaryMatchThreshold) {
        this.lastDecision = {
          action: 'primary-match',
          speakerId: 'local-primary',
          score,
          atMs: Math.max(0, Number(atMs) || 0),
        }
        return Object.freeze({
          id: 'local-primary',
          name: this.primaryName,
          source: 'local-speaker-profile',
          confidence: score,
          newSpeaker: false,
          reason: 'primary-match',
        })
      }
    }

    let best = null
    for (const speaker of this.speakers) {
      const score = cosineSimilarity(speaker.centroid, vector)
      if (!best || score > best.score) best = { speaker, score }
    }

    if (best && best.score >= this.threshold) {
      return evidenceQuality === 'short'
        ? this.reuseSpeakerWithoutCentroidUpdate(
            best.speaker,
            atMs,
            best.score,
            'short-strong-match',
          )
        : this.updateSpeaker(
            best.speaker,
            vector,
            atMs,
            best.score,
            'strong-match',
          )
    }

    const limit = this.anonymousLimit()
    if (
      limit != null &&
      this.speakers.length >= limit
    ) {
      if (best && best.score >= this.softThreshold) {
        return evidenceQuality === 'short'
          ? this.reuseSpeakerWithoutCentroidUpdate(
              best.speaker,
              atMs,
              best.score,
              'expected-count-short-soft-match',
            )
          : this.updateSpeaker(
              best.speaker,
              vector,
              atMs,
              best.score,
              'expected-count-soft-match',
            )
      }

      if (
        evidenceQuality === 'short' &&
        best &&
        best.score >= this.shortMatchThreshold
      ) {
        return this.reuseSpeakerWithoutCentroidUpdate(
          best.speaker,
          atMs,
          best.score,
          'expected-count-short-recovery',
        )
      }

      this.lastDecision = {
        action: 'expected-count-guard',
        speakerId: null,
        score: best?.score ?? null,
        atMs: Math.max(0, Number(atMs) || 0),
      }
      return Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: best?.score ?? null,
        newSpeaker: false,
        reason: 'expected-count-guard',
      })
    }

    if (evidenceQuality === 'short') {
      this.lastDecision = {
        action: 'short-evidence-no-new-speaker',
        speakerId: null,
        score: best?.score ?? null,
        atMs: Math.max(0, Number(atMs) || 0),
      }
      return Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: best?.score ?? null,
        newSpeaker: false,
        reason: 'short-evidence-no-new-speaker',
      })
    }

    const number = this.nextSpeaker++
    const speaker = {
      id: 'meeting-speaker-' + number,
      name: 'SPEAKER ' + number,
      centroid: Object.freeze(Array.from(vector)),
      sampleCount: 1,
      firstSeenAtMs: Math.max(0, Number(atMs) || 0),
      lastSeenAtMs: Math.max(0, Number(atMs) || 0),
    }
    this.speakers.push(speaker)
    this.lastDecision = {
      action: 'new-speaker',
      speakerId: speaker.id,
      score: best?.score ?? null,
      atMs: Math.max(0, Number(atMs) || 0),
    }

    return Object.freeze({
      id: speaker.id,
      name: speaker.name,
      source: 'diarization',
      confidence: best?.score ?? 1,
      newSpeaker: true,
      reason: 'new-speaker',
    })
  }

  status() {
    return Object.freeze({
      phase: 'MI-04',
      threshold: this.threshold,
      softThreshold: this.softThreshold,
      shortMatchThreshold: this.shortMatchThreshold,
      mergeThreshold: this.mergeThreshold,
      expectedParticipants: this.expectedParticipants,
      anonymousSpeakerLimit: this.anonymousLimit(),
      anonymousSpeakerCount: this.speakers.length,
      primaryProfileAvailable: Boolean(this.primaryProfile?.embedding?.length),
      shortRecoveryCount: this.shortRecoveryCount,
      lastDecision: this.lastDecision
        ? Object.freeze({ ...this.lastDecision })
        : null,
      aliases: Object.freeze(
        [...this.aliases.entries()].map(([from, to]) =>
          Object.freeze({ from, to }),
        ),
      ),
      merges: Object.freeze(this.merges.slice(-12)),
      speakers: Object.freeze(
        this.speakers.map((speaker) =>
          Object.freeze({
            id: speaker.id,
            name: speaker.name,
            sampleCount: speaker.sampleCount,
            firstSeenAtMs: speaker.firstSeenAtMs,
            lastSeenAtMs: speaker.lastSeenAtMs,
          }),
        ),
      ),
    })
  }
}

const trackers = new Map()

export function getMeetingSpeakerTracker(
  meetingId,
  {
    env = process.env,
    primaryName = 'LOCAL USER',
    expectedParticipants = null,
  } = {},
) {
  const id = String(meetingId ?? '').trim()
  if (!id) throw new Error('meetingId is required')

  let tracker = trackers.get(id)
  if (tracker) {
    tracker.setExpectedParticipants(expectedParticipants)
    return tracker
  }

  let primaryProfile = null
  try {
    primaryProfile = loadSpeakerProfile()
  } catch {
    primaryProfile = null
  }

  tracker = new PersistentMeetingSpeakerTracker({
    threshold: trackerThreshold(env),
    softThreshold: trackerSoftThreshold(env),
    shortMatchThreshold: trackerShortMatchThreshold(env),
    mergeThreshold: trackerMergeThreshold(env),
    expectedParticipants,
    primaryProfile,
    primaryName,
    primaryMatchThreshold: primaryThreshold(env),
  })
  trackers.set(id, tracker)
  return tracker
}

export function clearMeetingSpeakerTracker(meetingId) {
  return trackers.delete(String(meetingId ?? '').trim())
}

export function meetingSpeakerTrackerStatus(meetingId) {
  const tracker = trackers.get(String(meetingId ?? '').trim())
  return tracker ? tracker.status() : null
}

function concatenateClusterAudio(decoded, segments) {
  const maxSamples = Math.floor(decoded.sampleRate * MAX_EMBED_SECONDS)
  const chunks = []
  let total = 0

  for (const segment of segments) {
    const start = Math.max(
      0,
      Math.floor(Number(segment.start) * decoded.sampleRate),
    )
    const end = Math.min(
      decoded.samples.length,
      Math.ceil(Number(segment.end) * decoded.sampleRate),
    )
    if (end <= start) continue

    const available = maxSamples - total
    if (available <= 0) break
    const slice = decoded.samples.slice(start, Math.min(end, start + available))
    chunks.push(slice)
    total += slice.length
  }

  const durationSeconds = total / decoded.sampleRate
  if (durationSeconds < MIN_SHORT_EMBED_SECONDS) return null

  const samples = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }

  return Object.freeze({
    wav: encodeMonoPcm16Wav(samples, decoded.sampleRate),
    durationSeconds,
    quality:
      durationSeconds < MIN_EMBED_SECONDS ? 'short' : 'normal',
  })
}

function computeMeetingEmbedding(audio, env, quality = 'normal') {
  return computeSpeakerEmbedding(audio, {
    env,
    samplePolicy:
      quality === 'short'
        ? MEETING_SHORT_SAMPLE_POLICY
        : MEETING_SAMPLE_POLICY,
  })
}

export async function transcribeTrackedRoomChunk(
  meetingId,
  audio,
  {
    offsetMs = 0,
    primaryName = 'LOCAL USER',
    expectedParticipants = null,
    env = process.env,
  } = {},
) {
  const baseOffset = Math.max(0, Number(offsetMs) || 0)
  const decoded = decodeMonoPcm16Wav(audio)
  const diarization = diarizeLocalWav(audio, { env })
  const merged = mergeSpeakerSegments(diarization.segments)
  const tracker = getMeetingSpeakerTracker(meetingId, {
    env,
    primaryName,
    expectedParticipants,
  })

  if (!merged.length) {
    const transcription = await transcribeLocalWav(audio, { env })
    let identity = null
    try {
      const embedding = computeMeetingEmbedding(audio, env)
      identity = tracker.assignEmbedding(embedding, { atMs: baseOffset })
    } catch {
      identity = Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: null,
        newSpeaker: false,
        reason: 'embedding-unavailable',
      })
    }

    return Object.freeze({
      turns: Object.freeze([
        Object.freeze({
          speakerId: identity.id,
          speakerName: identity.name,
          speakerIdentitySource: identity.source,
          speakerConfidence: identity.confidence,
          start: 0,
          end: decoded.samples.length / decoded.sampleRate,
          text: transcription.text,
          language: transcription.language,
        }),
      ]),
      tracking: tracker.status(),
      diarization,
    })
  }

  const clusters = new Map()
  for (const segment of merged) {
    if (!clusters.has(segment.speaker)) clusters.set(segment.speaker, [])
    clusters.get(segment.speaker).push(segment)
  }

  const identities = new Map()
  for (const [localSpeaker, segments] of clusters) {
    const clusterAudio = concatenateClusterAudio(decoded, segments)
    if (!clusterAudio) {
      identities.set(
        localSpeaker,
        Object.freeze({
          id: null,
          name: 'Unknown speaker',
          source: 'anonymous',
          confidence: null,
          newSpeaker: false,
          reason: 'cluster-too-short',
        }),
      )
      continue
    }

    try {
      const embedding = computeMeetingEmbedding(
        clusterAudio.wav,
        env,
        clusterAudio.quality,
      )
      identities.set(
        localSpeaker,
        tracker.assignEmbedding(embedding, {
          atMs:
            baseOffset +
            Math.max(0, Number(segments[0]?.start) || 0) * 1000,
          evidenceQuality: clusterAudio.quality,
        }),
      )
    } catch {
      identities.set(
        localSpeaker,
        Object.freeze({
          id: null,
          name: 'Unknown speaker',
          source: 'anonymous',
          confidence: null,
          newSpeaker: false,
          reason: 'embedding-unavailable',
        }),
      )
    }
  }

  const turns = []
  for (const segment of merged) {
    const wav = sliceSpeakerSegment(decoded, segment)
    if (!wav) continue

    let transcription
    try {
      transcription = await transcribeLocalWav(wav, { env })
    } catch {
      transcription = { text: '', language: 'es' }
    }
    if (!String(transcription.text ?? '').trim()) continue

    const identity = identities.get(segment.speaker)
    turns.push(
      Object.freeze({
        speakerId: identity?.id ?? null,
        speakerName: identity?.name ?? 'Unknown speaker',
        speakerIdentitySource: identity?.source ?? 'anonymous',
        speakerConfidence: identity?.confidence ?? null,
        start: segment.start,
        end: segment.end,
        text: transcription.text,
        language: transcription.language,
      }),
    )
  }

  return Object.freeze({
    turns: Object.freeze(turns),
    tracking: tracker.status(),
    diarization,
  })
}
