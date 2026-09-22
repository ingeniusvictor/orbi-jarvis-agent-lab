/**
 * MI-02 Persistent Speaker Tracking for room meetings.
 *
 * Anonymous participant embeddings exist only in process memory for the active
 * meeting. They are never written to the durable meeting store. This gives
 * stable SPEAKER identities across audio chunks without creating persistent
 * biometric profiles for other participants.
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

const DEFAULT_TRACK_THRESHOLD = 0.68
const DEFAULT_PRIMARY_THRESHOLD = 0.60
const MAX_EMBED_SECONDS = 9.5
const MIN_EMBED_SECONDS = 2.0

const clampThreshold = (value, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(-1, Math.min(1, n))
}

function trackerThreshold(env = process.env) {
  return clampThreshold(
    env.ORBIA_MEETING_SPEAKER_TRACK_THRESHOLD,
    DEFAULT_TRACK_THRESHOLD,
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

export class PersistentMeetingSpeakerTracker {
  constructor({
    threshold = DEFAULT_TRACK_THRESHOLD,
    primaryProfile = null,
    primaryName = 'LOCAL USER',
    primaryMatchThreshold = DEFAULT_PRIMARY_THRESHOLD,
  } = {}) {
    this.threshold = clampThreshold(threshold, DEFAULT_TRACK_THRESHOLD)
    this.primaryProfile = primaryProfile
    this.primaryName = String(primaryName || 'LOCAL USER').trim() || 'LOCAL USER'
    this.primaryMatchThreshold = clampThreshold(
      primaryMatchThreshold,
      DEFAULT_PRIMARY_THRESHOLD,
    )
    this.speakers = []
    this.nextSpeaker = 1
  }

  assignEmbedding(embedding, { atMs = 0 } = {}) {
    const vector = Array.from(embedding ?? [], Number)
    if (!vector.length) {
      return Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: null,
        newSpeaker: false,
      })
    }

    if (this.primaryProfile?.embedding?.length) {
      const score = cosineSimilarity(this.primaryProfile.embedding, vector)
      if (score >= this.primaryMatchThreshold) {
        return Object.freeze({
          id: 'local-primary',
          name: this.primaryName,
          source: 'local-speaker-profile',
          confidence: score,
          newSpeaker: false,
        })
      }
    }

    let best = null
    for (const speaker of this.speakers) {
      const score = cosineSimilarity(speaker.centroid, vector)
      if (!best || score > best.score) best = { speaker, score }
    }

    if (best && best.score >= this.threshold) {
      best.speaker.centroid = weightedCentroid(
        best.speaker.centroid,
        best.speaker.sampleCount,
        vector,
      )
      best.speaker.sampleCount += 1
      best.speaker.lastSeenAtMs = Math.max(
        best.speaker.lastSeenAtMs,
        Number(atMs) || 0,
      )
      return Object.freeze({
        id: best.speaker.id,
        name: best.speaker.name,
        source: 'diarization',
        confidence: best.score,
        newSpeaker: false,
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

    return Object.freeze({
      id: speaker.id,
      name: speaker.name,
      source: 'diarization',
      confidence: 1,
      newSpeaker: true,
    })
  }

  status() {
    return Object.freeze({
      threshold: this.threshold,
      anonymousSpeakerCount: this.speakers.length,
      primaryProfileAvailable: Boolean(this.primaryProfile?.embedding?.length),
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
  } = {},
) {
  const id = String(meetingId ?? '').trim()
  if (!id) throw new Error('meetingId is required')

  let tracker = trackers.get(id)
  if (tracker) return tracker

  let primaryProfile = null
  try {
    primaryProfile = loadSpeakerProfile()
  } catch {
    primaryProfile = null
  }

  tracker = new PersistentMeetingSpeakerTracker({
    threshold: trackerThreshold(env),
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
  if (durationSeconds < MIN_EMBED_SECONDS) return null

  const samples = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }
  return encodeMonoPcm16Wav(samples, decoded.sampleRate)
}

export async function transcribeTrackedRoomChunk(
  meetingId,
  audio,
  {
    offsetMs = 0,
    primaryName = 'LOCAL USER',
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
  })

  if (!merged.length) {
    const transcription = await transcribeLocalWav(audio, { env })
    let identity = null
    try {
      const embedding = computeSpeakerEmbedding(audio, { env })
      identity = tracker.assignEmbedding(embedding, { atMs: baseOffset })
    } catch {
      identity = Object.freeze({
        id: null,
        name: 'Unknown speaker',
        source: 'anonymous',
        confidence: null,
        newSpeaker: false,
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
    const clusterWav = concatenateClusterAudio(decoded, segments)
    if (!clusterWav) {
      identities.set(
        localSpeaker,
        Object.freeze({
          id: null,
          name: 'Unknown speaker',
          source: 'anonymous',
          confidence: null,
          newSpeaker: false,
        }),
      )
      continue
    }

    try {
      const embedding = computeSpeakerEmbedding(clusterWav, { env })
      identities.set(
        localSpeaker,
        tracker.assignEmbedding(embedding, {
          atMs:
            baseOffset +
            Math.max(0, Number(segments[0]?.start) || 0) * 1000,
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
