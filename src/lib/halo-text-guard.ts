/**
 * UX-04C — measure DOM text line boxes against the OUTER luminous halo.
 * A sampled shape-outside float provides the preferred elegant curve.
 * If Chrome skips that wrapping for a short/multiline block, this geometry
 * provides an independent, measurable no-collision guard.
 */
import type { HaloCircle, HaloSide } from './halo-flow-geometry'

export type TextLineBox = {
  left: number; right: number; top: number; bottom: number
}

/** How far existing glyph boxes must move away from the ring, in CSS px. */
export function requiredHaloTextInset(
  side: HaloSide, lines: ReadonlyArray<TextLineBox>, circle: HaloCircle,
  opticalGap = 14,
): number {
  if (!Number.isFinite(circle.x) || !Number.isFinite(circle.y) ||
      !Number.isFinite(circle.radius) || circle.radius <= 0 ||
      !Number.isFinite(opticalGap) || opticalGap < 0) return 0
  const exclusionRadius = circle.radius + opticalGap
  let maxInset = 0
  for (const line of lines) {
    if (![line.left, line.right, line.top, line.bottom].every(Number.isFinite)) continue
    if (line.bottom <= circle.y - exclusionRadius ||
        line.top >= circle.y + exclusionRadius) continue
    // Clamping to the line's vertical extent finds the closest point to
    // ring centre, hence the WIDEST part of the protected disc at that line.
    const y = Math.min(line.bottom, Math.max(line.top, circle.y))
    const dy = y - circle.y
    const halfChord = Math.sqrt(Math.max(0,
      exclusionRadius * exclusionRadius - dy * dy))
    const ringEdge = side === 'right'
      ? circle.x + halfChord
      : circle.x - halfChord
    const needed = side === 'right'
      ? ringEdge - line.left
      : line.right - ringEdge
    if (needed > maxInset) maxInset = needed
  }
  return Math.max(0, maxInset)
}
