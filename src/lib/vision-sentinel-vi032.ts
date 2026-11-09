/**
 * VI-03.2A — CPU-only optical change sentinel.
 *
 * Tiny RGBA frame (96x54), deliberate opt-in, no new webcam owner,
 * no model loading, no CUDA/WebGL/WebGPU, no image/audio persistence.
 *
 * This is NOT a person detector or semantic scene understanding.
 * It reports possible optical changes inside a polygon, not "someone entered".
 */
export const SENTINEL_WIDTH = 96
export const SENTINEL_HEIGHT = 54
export const SENTINEL_INTERVAL_MS = 750
export const SENTINEL_EVENT_COOLDOWN_MS = 8_000
export const SENTINEL_MIN_FRACTION = 0.065
export const SENTINEL_PIXEL_DELTA = 28
export type SentinelZone = 'center' | 'full'
export type SentinelStatus = 'calibrating' | 'stable' | 'possible-change' | 'event' | 'lighting-change'
export type SentinelObservation = {
  status: SentinelStatus
  changedFraction: number
  timestamp: number
  zone: SentinelZone
}
type Point = { x: number; y: number }

/** Four-vertex region, coordinates normalized to the original camera frame. */
export const SENTINEL_CENTER_POLYGON: readonly Point[] = [
  {x: 0.16, y: 0.15},
  {x: 0.84, y: 0.15},
  {x: 0.84, y: 0.88},
  {x: 0.16, y: 0.88},
]

function insidePolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a.y > y) !== (b.y > y) &&
      x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

const MASK_CENTER = new Uint8Array(SENTINEL_WIDTH * SENTINEL_HEIGHT)
for (let y = 0; y < SENTINEL_HEIGHT; y++) {
  for (let x = 0; x < SENTINEL_WIDTH; x++) {
    MASK_CENTER[y * SENTINEL_WIDTH + x] = insidePolygon(
      (x + 0.5) / SENTINEL_WIDTH, (y + 0.5) / SENTINEL_HEIGHT,
      SENTINEL_CENTER_POLYGON,
    ) ? 1 : 0
  }
}

/** Pixel-only processing; use a reusable 96x54 canvas upstream. */
export function toSentinelLuma(rgba: ArrayLike<number>): Uint8Array {
  if (rgba.length !== SENTINEL_WIDTH * SENTINEL_HEIGHT * 4) {
    throw new Error('Resolución de fotograma Sentinel inválida.')
  }
  const lum = new Uint8Array(SENTINEL_WIDTH * SENTINEL_HEIGHT)
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    // Integer approximation of Rec.601 luma.
    lum[p] = (77 * rgba[i] + 150 * rgba[i + 1] + 29 * rgba[i + 2]) >>> 8
  }
  return lum
}

export class OpticalSentinel {
  private reference: Uint8Array | null = null
  private currentZone: SentinelZone | null = null
  private candidateCount = 0
  private cooldownUntil = 0
  private lastAt = 0

  reset(): void {
    this.reference = null
    this.currentZone = null
    this.candidateCount = 0
    this.cooldownUntil = 0
    this.lastAt = 0
  }

  observe(luma: Uint8Array, zone: SentinelZone, at: number): SentinelObservation {
    if (luma.length !== SENTINEL_WIDTH * SENTINEL_HEIGHT) {
      throw new Error('Fotograma Sentinel de tamaño inválido.')
    }
    if (!Number.isFinite(at) || at < 0) throw new Error('Reloj Sentinel inválido.')
    if (zone !== 'full' && zone !== 'center') throw new Error('Zona Sentinel inválida.')

    const basic = (status: SentinelStatus, changedFraction = 0): SentinelObservation =>
      ({ status, changedFraction, timestamp: at, zone })

    if (!this.reference || this.currentZone !== zone || at < this.lastAt) {
      this.reference = luma.slice()
      this.currentZone = zone
      this.candidateCount = 0
      this.lastAt = at
      return basic('calibrating')
    }
    this.lastAt = at
    const mask = zone === 'center' ? MASK_CENTER : null
    let changed = 0
    let sumShift = 0
    let samples = 0
    for (let p = 0; p < luma.length; p++) {
      if (mask && !mask[p]) continue
      const delta = luma[p] - this.reference[p]
      sumShift += delta
      if (Math.abs(delta) >= SENTINEL_PIXEL_DELTA) changed++
      samples++
    }
    const ratio = samples ? changed / samples : 0
    // Abrupt global brightness jump is often auto-exposure, not a new person.
    if (Math.abs(sumShift / Math.max(1, samples)) >= 24) {
      this.reference = luma.slice()
      this.candidateCount = 0
      return basic('lighting-change', ratio)
    }
    if (ratio < SENTINEL_MIN_FRACTION) {
      this.reference = luma.slice()
      this.candidateCount = 0
      return basic('stable', ratio)
    }
    this.candidateCount++
    if (this.candidateCount < 2 || at < this.cooldownUntil) {
      return basic('possible-change', ratio)
    }
    this.cooldownUntil = at + SENTINEL_EVENT_COOLDOWN_MS
    this.candidateCount = 0
    this.reference = luma.slice()
    return basic('event', ratio)
  }
}
