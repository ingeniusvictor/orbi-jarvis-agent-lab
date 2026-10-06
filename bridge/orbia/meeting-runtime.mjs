/**
 * MI-05 Meeting Reliability runtime state.
 *
 * Native diarization is optional for continuity: room transcription must keep
 * working when Windows application control or another runtime failure blocks
 * sherpa-onnx. Probe once, cache the result, and let the meeting pipeline
 * choose a latency profile without retrying a known-bad native load for every
 * audio chunk.
 */

import { probeSpeakerDiarization } from './speaker-diarization-probe.mjs'

const FULL_ROOM_CHUNK_SECONDS = 10
const DEGRADED_ROOM_CHUNK_SECONDS = 3

let cachedStatus = null

const cleanError = (value) =>
  String(value ?? '')
    .split('\n')[0]
    .trim()
    .slice(0, 240) || null

function statusFromProbe(probe, { reason = null } = {}) {
  const available = Boolean(probe?.available)
  const mode = available ? 'full' : 'degraded'

  return Object.freeze({
    phase: 'MI-05',
    mode,
    transcriptionProvider: 'whisper-local',
    roomChunkSeconds:
      mode === 'full'
        ? FULL_ROOM_CHUNK_SECONDS
        : DEGRADED_ROOM_CHUNK_SECONDS,
    diarization: Object.freeze({
      available,
      provider: probe?.provider ?? 'sherpa-onnx-local',
      packageReady: Boolean(probe?.packageReady),
      runtimeLoadReady: Boolean(probe?.runtimeLoadReady),
      segmentationReady: Boolean(probe?.segmentationReady),
      embeddingReady: Boolean(probe?.embeddingReady),
      reason:
        cleanError(reason) ||
        cleanError(probe?.runtimeLoadError) ||
        (available ? null : 'diarization-unavailable'),
    }),
  })
}

export function getMeetingRuntimeStatus({
  refresh = false,
  env = process.env,
  probe = probeSpeakerDiarization,
} = {}) {
  if (!refresh && cachedStatus) return cachedStatus

  try {
    cachedStatus = statusFromProbe(probe({ env }))
  } catch (error) {
    cachedStatus = statusFromProbe(null, { reason: error?.message ?? error })
  }
  return cachedStatus
}

export function markMeetingRuntimeDegraded(error = null) {
  const previous = cachedStatus?.diarization ?? {}
  cachedStatus = statusFromProbe(
    {
      provider: previous.provider ?? 'sherpa-onnx-local',
      packageReady: previous.packageReady,
      runtimeLoadReady: false,
      segmentationReady: previous.segmentationReady,
      embeddingReady: previous.embeddingReady,
      available: false,
    },
    { reason: error?.message ?? error ?? 'diarization-runtime-failed' },
  )
  return cachedStatus
}

export function resetMeetingRuntimeStatusForTests() {
  cachedStatus = null
}
