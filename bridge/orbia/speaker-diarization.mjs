/**
 * VF-02 local speaker diarization adapter.
 *
 * This adapter is intentionally not in the hot path yet. It can be installed
 * and benchmarked independently before multivoice routing is enabled.
 *
 * Provider: sherpa-onnx-node OfflineSpeakerDiarization
 * Input: mono PCM16 WAV (the same 16 kHz format already produced for Whisper)
 * Output: anonymous per-clip speaker segments.
 */

import { createRequire } from 'node:module'
import { probeSpeakerDiarization } from './speaker-diarization-probe.mjs'
import { speakerDiarizationPaths } from './speaker-diarization-probe.mjs'

const require = createRequire(import.meta.url)

export class SpeakerDiarizationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SpeakerDiarizationError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new SpeakerDiarizationError(code, message)
}

const four = (bytes, offset) =>
  String.fromCharCode(...bytes.slice(offset, offset + 4))

export function decodeMonoPcm16Wav(audio) {
  const bytes =
    audio instanceof Uint8Array
      ? audio
      : Buffer.isBuffer(audio)
        ? new Uint8Array(audio)
        : null

  if (!bytes || bytes.byteLength < 44) {
    fail('DIARIZATION_INVALID_AUDIO', 'Audio is not a valid WAV file.')
  }
  if (four(bytes, 0) !== 'RIFF' || four(bytes, 8) !== 'WAVE') {
    fail('DIARIZATION_INVALID_AUDIO', 'Audio is not RIFF/WAVE.')
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  )

  let offset = 12
  let format = null
  let dataOffset = -1
  let dataSize = 0

  while (offset + 8 <= bytes.byteLength) {
    const id = four(bytes, offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8

    if (body + size > bytes.byteLength) break

    if (id === 'fmt ' && size >= 16) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      }
    }

    if (id === 'data') {
      dataOffset = body
      dataSize = size
      break
    }

    offset = body + size + (size % 2)
  }

  if (!format || dataOffset < 0 || dataSize < 2) {
    fail('DIARIZATION_INVALID_AUDIO', 'WAV format/data chunks are missing.')
  }
  if (
    format.audioFormat !== 1 ||
    format.channels !== 1 ||
    format.bitsPerSample !== 16
  ) {
    fail(
      'DIARIZATION_UNSUPPORTED_AUDIO',
      'Speaker diarization requires mono PCM16 WAV audio.',
    )
  }

  const sampleCount = Math.floor(dataSize / 2)
  const samples = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    const pcm = view.getInt16(dataOffset + i * 2, true)
    samples[i] = pcm < 0 ? pcm / 32768 : pcm / 32767
  }

  return Object.freeze({
    samples,
    sampleRate: format.sampleRate,
  })
}

let cached = null
let cachedKey = ''

function createRuntime(env = process.env) {
  const readiness = probeSpeakerDiarization({ env })
  if (!readiness.available) {
    fail(
      'DIARIZATION_UNAVAILABLE',
      'Local speaker diarization package or model assets are unavailable.',
    )
  }

  const paths = speakerDiarizationPaths(env)
  const key = `${paths.segmentationModel}\n${paths.embeddingModel}`
  if (cached && cachedKey === key) return cached

  let sherpa
  try {
    sherpa = require('sherpa-onnx-node')
  } catch {
    fail(
      'DIARIZATION_UNAVAILABLE',
      'sherpa-onnx-node could not be loaded.',
    )
  }

  const runtime = new sherpa.OfflineSpeakerDiarization({
    segmentation: {
      pyannote: {
        model: paths.segmentationModel,
        windowShiftRatio: 0.1,
      },
    },
    embedding: {
      model: paths.embeddingModel,
    },
    clustering: {
      numClusters: -1,
      threshold: Number(env.ORBIA_DIARIZATION_THRESHOLD ?? 0.5),
    },
    minDurationOn: Number(env.ORBIA_DIARIZATION_MIN_ON ?? 0.2),
    minDurationOff: Number(env.ORBIA_DIARIZATION_MIN_OFF ?? 0.5),
  })

  cached = runtime
  cachedKey = key
  return runtime
}

export function diarizeLocalWav(audio, { env = process.env } = {}) {
  const decoded = decodeMonoPcm16Wav(audio)
  const runtime = createRuntime(env)

  if (
    Number.isFinite(runtime.sampleRate) &&
    runtime.sampleRate !== decoded.sampleRate
  ) {
    fail(
      'DIARIZATION_UNSUPPORTED_AUDIO',
      `Diarizer expects ${runtime.sampleRate} Hz, received ${decoded.sampleRate} Hz.`,
    )
  }

  let raw
  try {
    raw = runtime.process(decoded.samples)
  } catch {
    fail('DIARIZATION_FAILED', 'Local speaker diarization failed.')
  }

  const segments = Array.isArray(raw)
    ? raw
        .map((segment) => ({
          start: Number(segment?.start ?? 0),
          end: Number(segment?.end ?? 0),
          speaker: Number(segment?.speaker ?? 0),
        }))
        .filter(
          (segment) =>
            Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) &&
            Number.isFinite(segment.speaker) &&
            segment.end > segment.start,
        )
    : []

  const speakerIds = [...new Set(segments.map((segment) => segment.speaker))]

  return Object.freeze({
    provider: 'sherpa-onnx-local',
    sampleRate: decoded.sampleRate,
    speakerCount: speakerIds.length,
    speakerIds: Object.freeze(speakerIds),
    segments: Object.freeze(segments),
  })
}
