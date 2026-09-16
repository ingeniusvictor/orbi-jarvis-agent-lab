/**
 * Experimental VF-02 multivoice transcription.
 *
 * This is deliberately outside the normal Companion hot path. It combines
 * local sherpa diarization with the already-certified local Whisper adapter and
 * returns anonymous speaker-labelled text for explicit experiments.
 */

import {
  decodeMonoPcm16Wav,
  diarizeLocalWav,
} from './speaker-diarization.mjs'
import { transcribeLocalWav } from './local-stt.mjs'

const MAX_SEGMENTS = 8
const MIN_SEGMENT_SECONDS = 0.35
const MERGE_GAP_SECONDS = 0.45

export function mergeSpeakerSegments(segments) {
  const sorted = [...segments]
    .filter(
      (segment) =>
        Number.isFinite(segment?.start) &&
        Number.isFinite(segment?.end) &&
        Number.isFinite(segment?.speaker) &&
        segment.end > segment.start,
    )
    .sort((a, b) => a.start - b.start)

  const merged = []
  for (const segment of sorted) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.speaker === segment.speaker &&
      segment.start - last.end <= MERGE_GAP_SECONDS
    ) {
      last.end = Math.max(last.end, segment.end)
      continue
    }
    merged.push({
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker,
    })
  }

  return merged
    .filter((segment) => segment.end - segment.start >= MIN_SEGMENT_SECONDS)
    .slice(0, MAX_SEGMENTS)
}

export function encodeMonoPcm16Wav(samples, sampleRate = 16000) {
  const source =
    samples instanceof Float32Array ? samples : Float32Array.from(samples ?? [])
  const buffer = new ArrayBuffer(44 + source.length * 2)
  const view = new DataView(buffer)
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  write(0, 'RIFF')
  view.setUint32(4, 36 + source.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, source.length * 2, true)

  for (let i = 0; i < source.length; i++) {
    const sample = Math.max(-1, Math.min(1, source[i]))
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )
  }

  return new Uint8Array(buffer)
}

export function sliceSpeakerSegment(decoded, segment) {
  const start = Math.max(
    0,
    Math.floor(Number(segment.start) * decoded.sampleRate),
  )
  const end = Math.min(
    decoded.samples.length,
    Math.ceil(Number(segment.end) * decoded.sampleRate),
  )
  if (end <= start) return null
  return encodeMonoPcm16Wav(decoded.samples.slice(start, end), decoded.sampleRate)
}

export async function transcribeMultivoiceLocalWav(
  audio,
  { env = process.env } = {},
) {
  const diarization = diarizeLocalWav(audio, { env })
  const decoded = decodeMonoPcm16Wav(audio)
  const merged = mergeSpeakerSegments(diarization.segments)

  if (diarization.speakerCount < 2) {
    return Object.freeze({
      provider: 'sherpa-onnx-local+whisper-cpp-local',
      speakerCount: diarization.speakerCount,
      turns: Object.freeze([]),
      segments: diarization.segments,
    })
  }

  const turns = []
  for (const segment of merged) {
    const wav = sliceSpeakerSegment(decoded, segment)
    if (!wav) continue

    try {
      const transcription = await transcribeLocalWav(wav, { env })
      turns.push(
        Object.freeze({
          speakerId: segment.speaker,
          speaker: `SPEAKER ${segment.speaker + 1}`,
          start: segment.start,
          end: segment.end,
          text: transcription.text,
        }),
      )
    } catch {
      turns.push(
        Object.freeze({
          speakerId: segment.speaker,
          speaker: `SPEAKER ${segment.speaker + 1}`,
          start: segment.start,
          end: segment.end,
          text: '',
        }),
      )
    }
  }

  return Object.freeze({
    provider: 'sherpa-onnx-local+whisper-cpp-local',
    speakerCount: diarization.speakerCount,
    turns: Object.freeze(turns),
    segments: diarization.segments,
  })
}
