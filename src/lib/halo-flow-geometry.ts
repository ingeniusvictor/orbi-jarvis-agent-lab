/** UX-04B: real circle exclusion coordinates in DOM pixels, mirrored by side. */
export type HaloSide = 'left' | 'right'
export type HaloRect = { left: number; right: number; top: number; bottom: number; width: number }
export type HaloCircle = { x: number; y: number; radius: number }
export type HaloExclusion = {
  width: number
  height: number
  shape: string
  float: 'left' | 'right'
}

export function computeHaloExclusion(
  side: HaloSide, rect: HaloRect, circle: HaloCircle,
  contentBottom: number, minTextWidth = 175,
): HaloExclusion | null {
  if (![rect.left, rect.right, rect.top, rect.bottom, rect.width,
    circle.x, circle.y, circle.radius, contentBottom].every(Number.isFinite) ||
    rect.width <= minTextWidth || circle.radius <= 0) return null

  const ringStart = circle.x - circle.radius
  const ringEnd = circle.x + circle.radius
  // The LEFT reading rail must have its circular float on the RIGHT edge,
  // the RIGHT reading rail must have its float on the LEFT edge. Use the
  // circle's actual screen-space position, not a mirrored screen origin.
  const sideOverlap = side === 'left'
    ? rect.right - ringStart
    : ringEnd - rect.left
  const width = Math.min(Math.max(0, sideOverlap), rect.width - minTextWidth)
  if (width <= 0.5 || rect.top >= circle.y + circle.radius ||
      rect.bottom <= circle.y - circle.radius) return null

  // A float belongs to ONE transcript item, not the entire history. Limiting
  // its height to actual content avoids hundreds of pixels of blank space
  // between consecutive turns, while keeping the correct curve per line.
  const height = Math.min(
    2 * circle.radius,
    circle.y + circle.radius - rect.top,
    Math.max(28, contentBottom + 5),
  )
  if (height <= 0) return null

  // circle() coordinates are relative to the FLOAT margin box, not the pane.
  // For the response pane this is intentionally often a NEGATIVE cx: the
  // centre of LUMIA lies outside the panel, to its left. No x inversion.
  const floatLeft = side === 'left' ? rect.right - width : rect.left
  const cx = circle.x - floatLeft
  const cy = circle.y - rect.top
  const shape = 'circle(' + circle.radius.toFixed(1) + 'px at ' +
    cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px)'
  return { width, height, shape, float: side === 'left' ? 'right' : 'left' }
}

/** Get centre from the live rendered 3D canvas rather than window assumptions. */
export function haloCircleForCanvas(
  rect: { left: number; top: number; width: number; height: number },
): HaloCircle {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    radius: Math.min(rect.height * 0.355, rect.width * 0.245) + 16,
  }
}
