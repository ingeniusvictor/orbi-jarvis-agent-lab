import { useEffect, useRef, type ReactNode } from 'react'
import { computeHaloExclusion, haloCircleForCanvas } from '../lib/halo-flow-geometry'
import { requiredHaloTextInset, type TextLineBox } from '../lib/halo-text-guard'

/**
 * UX-04C: true CSS contour when the browser wraps correctly, with a
 * second, independent guard measured against the ACTUAL rendered text lines.
 *
 * If shape-outside fails to keep a particular answer outside the bright ring
 * (e.g. because an inline DecodeText span or time label forms a new block),
 * fallback for THAT answer only to a bounded outward text inset. Never clip
 * glyphs, move the 3D model or draw over the text.
 */
const ENABLED = import.meta.env.VITE_LUMIA_CURVED_TEXT === '1'
const MIN_READABLE_TEXT = 190

export function HaloFlow({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ENABLED) return
    const element = root.current
    const spacer = element?.querySelector<HTMLElement>('.voice-halo-float')
    const pane = element?.closest<HTMLElement>('.voice-pane')
    if (!element || !spacer || !pane) return

    const formerBackground = pane.style.background
    const formerBackdrop = pane.style.backdropFilter
    const setPaneFinish = (wide: boolean) => {
      pane.style.background = wide ? 'none' : formerBackground
      pane.style.backdropFilter = wide ? 'none' : formerBackdrop
    }
    let frame = 0
    let guardFrame = 0
    let disposed = false
    let previous = ''
    let hardGuard = false

    // A DOM Range reports one rectangle per visibly laid-out text line.
    // This protects the timeline label and diagnostic rows as well as answers.
    const textLineRects = (): TextLineBox[] => {
      const output: TextLineBox[] = []
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node: Node | null
      let visited = 0
      while ((node = walker.nextNode()) && visited < 200 && output.length < 320) {
        visited++
        if (!node.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of Array.from(range.getClientRects())) {
          if (r.width > 0 && r.height > 0)
            output.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
          if (output.length >= 320) break
        }
      }
      return output
    }

    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(layout)
    }
    const verify = (circle: ReturnType<typeof haloCircleForCanvas>) => {
      guardFrame = 0
      if (disposed || window.innerWidth < 1201) return
      const lines = textLineRects()
      const overlap = requiredHaloTextInset(side, lines, circle, 14)
      if (overlap < 1) return

      if (!hardGuard) {
        // If CSS floated shape still overlaps any actual line, don't rely
        // on it for this answer. An independent per-turn inset is safer.
        hardGuard = true
        previous = 'hard-guard'
        spacer.style.display = 'none'
        spacer.style.shapeOutside = 'none'
        spacer.style.width = '0px'
        spacer.style.height = '0px'
        schedule()
        return
      }
      const current = Number.parseFloat(
        side === 'right' ? element.style.paddingLeft : element.style.paddingRight,
      ) || 0
      const maxInset = Math.max(0, element.getBoundingClientRect().width - MIN_READABLE_TEXT)
      const next = Math.min(maxInset, Math.ceil(current + overlap + 3))
      if (next > current + 0.5) {
        if (side === 'right') element.style.paddingLeft = next + 'px'
        else element.style.paddingRight = next + 'px'
        schedule()
      }
    }

    const layout = () => {
      frame = 0
      if (disposed) return
      const rect = element.getBoundingClientRect()
      const wide = window.innerWidth >= 1201
      setPaneFinish(wide)
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.scene')
      const canvasRect = canvas?.getBoundingClientRect() ?? {
        left: 0, top: 0, width: window.innerWidth, height: window.innerHeight,
      }
      const circle = haloCircleForCanvas(canvasRect)
      if (!hardGuard) {
        const childEnds = Array.from(element.children)
          .filter(child => child !== spacer)
          .map(child => child.getBoundingClientRect().bottom - rect.top)
        const exclusion = wide ? computeHaloExclusion(
          side, rect, circle, Math.max(28, ...childEnds),
        ) : null
        if (!exclusion) {
          if (previous !== 'off') {
            spacer.style.width = '0px'
            spacer.style.height = '0px'
            spacer.style.shapeOutside = 'none'
            previous = 'off'
          }
        } else {
          const { width, height, shape } = exclusion
          const fingerprint = [width.toFixed(1), height.toFixed(1), shape].join('|')
          if (fingerprint !== previous) {
            spacer.style.width = width.toFixed(1) + 'px'
            spacer.style.height = height.toFixed(1) + 'px'
            spacer.style.shapeOutside = shape
            previous = fingerprint
          }
        }
      }
      // Validate AFTER Chrome reflows. Looking only at the math would miss the
      // user's actual problem: text inside the ring despite a correct polygon.
      if (guardFrame) cancelAnimationFrame(guardFrame)
      guardFrame = requestAnimationFrame(() => verify(circle))
    }

    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    observer.observe(pane)
    pane.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      cancelAnimationFrame(guardFrame)
      observer.disconnect()
      pane.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      pane.style.background = formerBackground
      pane.style.backdropFilter = formerBackdrop
      element.style.paddingLeft = ''
      element.style.paddingRight = ''
    }
  }, [side])

  return (
    <div ref={root} className={'voice-halo-flow voice-halo-flow-' + side} style={{ display: 'flow-root' }}>
      {ENABLED && <span className="voice-halo-float" aria-hidden="true"
        style={{ float: side === 'left' ? 'right' : 'left' }} />}
      {children}
    </div>
  )
}
