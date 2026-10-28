/**
 * VL-06 Windows browser acoustic check: only numerical sound-level samples.
 * No microphone frames, audio files, recordings or transcripts leave RAM.
 */
export function acousticRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) {
    if (!Number.isFinite(sample)) return 0
    sum += sample * sample
  }
  return Math.sqrt(sum / samples.length)
}

export function acousticDbfs(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return -100
  return Math.max(-100, Math.min(0, 20 * Math.log10(rms)))
}

export function acousticLevelPercent(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 0
  return Math.max(0, Math.min(100, Math.round(((dbfs + 65) / 55) * 100)))
}

export type AcousticCheckSummary = Readonly<{
  micPeakDbfs: number | null
  micAboveFloor: boolean
  toneRequested: boolean
  toneHeardConfirmed: boolean
  hardwareCertified: false
  rawAudioStored: false
}>

export function acousticCheckSummary({
  micPeakDbfs,
  toneRequested,
  toneHeardConfirmed,
}: {
  micPeakDbfs: number | null
  toneRequested: boolean
  toneHeardConfirmed: boolean
}): AcousticCheckSummary {
  return Object.freeze({
    micPeakDbfs: micPeakDbfs === null || !Number.isFinite(micPeakDbfs)
      ? null : Math.round(micPeakDbfs * 10) / 10,
    micAboveFloor: micPeakDbfs !== null && Number.isFinite(micPeakDbfs) &&
      micPeakDbfs > -45,
    toneRequested,
    toneHeardConfirmed: Boolean(toneRequested && toneHeardConfirmed),
    hardwareCertified: false as const,
    rawAudioStored: false as const,
  })
}
