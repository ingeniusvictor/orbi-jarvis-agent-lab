/**
 * VL-06: content-free Realtime turnaround telemetry.
 *
 * The documented WebRTC events report server-side end-of-speech detection and
 * the moment the service begins sending output audio. Their arrival on the
 * data channel is NOT proof of the first audible sample at the sound card.
 * No transcripts, waveforms, model IDs, PINs or credentials are retained.
 */
export type RealtimeTurnStats = Readonly<{
  count: number
  lastMs: number | null
  medianMs: number | null
  p95Ms: number | null
  interrupted: number
}>

const MAX_SAMPLES = 30
const MAX_PLAUSIBLE_TURN_MS = 30_000

export function summarizeRealtimeLatency(samples: number[], interrupted = 0): RealtimeTurnStats {
  const clean = samples.filter((v) => Number.isFinite(v) && v >= 0 && v <= MAX_PLAUSIBLE_TURN_MS)
  const sorted = [...clean].sort((a, b) => a - b)
  const pick = (p: number) => sorted.length
    ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
    : null
  return Object.freeze({
    count: sorted.length,
    lastMs: clean.length ? clean[clean.length - 1] : null,
    medianMs: pick(0.5),
    p95Ms: pick(0.95),
    interrupted,
  })
}

export function createRealtimeTurnMeter(
  onStats: (stats: RealtimeTurnStats) => void,
  now: () => number = () => performance.now(),
) {
  let pendingEndAt: number | null = null
  let interrupted = 0
  const samples: number[] = []

  const emit = () => onStats(summarizeRealtimeLatency(samples, interrupted))
  emit()

  return {
    onEvent(type: string) {
      if (type === 'input_audio_buffer.speech_stopped') {
        // All times are observed on the local data channel; this is a proxy.
        pendingEndAt = now()
      } else if (type === 'input_audio_buffer.speech_started') {
        // An interruption invalidates a pending output latency measurement.
        if (pendingEndAt !== null) {
          pendingEndAt = null
          interrupted++
          emit()
        }
      } else if (type === 'output_audio_buffer.started') {
        if (pendingEndAt === null) return
        const elapsed = Math.round(now() - pendingEndAt)
        pendingEndAt = null
        if (elapsed < 0 || elapsed > MAX_PLAUSIBLE_TURN_MS) return
        samples.push(elapsed)
        while (samples.length > MAX_SAMPLES) samples.shift()
        emit()
      } else if (type === 'output_audio_buffer.cleared') {
        if (pendingEndAt !== null) {
          pendingEndAt = null
          interrupted++
          emit()
        }
      }
    },
    snapshot: () => summarizeRealtimeLatency(samples, interrupted),
    clear: () => {
      pendingEndAt = null
      interrupted = 0
      samples.length = 0
      emit()
    },
  }
}
