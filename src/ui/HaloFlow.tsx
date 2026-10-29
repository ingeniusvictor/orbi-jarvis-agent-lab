import { useEffect, useRef, type ReactNode } from 'react'
import { computeHaloExclusion, haloCircleForCanvas } from '../lib/halo-flow-geometry'

/** UX-04: native CSS shape-outside circle for readable hologram-adjacent text. */
const ENABLED = import.meta.env.VITE_LUMIA_CURVED_TEXT === '1'
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
    let disposed = false
    let previous = ''
    const layout = () => {
      frame = 0
      if (disposed) return
      const rect = element.getBoundingClientRect()
      const wide = window.innerWidth >= 1201
      setPaneFinish(wide)
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.scene')
      const screenRect = canvas?.getBoundingClientRect() ?? {
        left: 0, top: 0, width: window.innerWidth, height: window.innerHeight,
      }
      const circle = haloCircleForCanvas(screenRect)
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
        return
      }
      const { width, height, shape } = exclusion
      const fingerprint = [width.toFixed(1), height.toFixed(1), shape].join('|')
      if (fingerprint === previous) return
      spacer.style.width = width.toFixed(1) + 'px'
      spacer.style.height = height.toFixed(1) + 'px'
      spacer.style.shapeOutside = shape
      previous = fingerprint
    }
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(layout) }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    observer.observe(pane)
    pane.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      pane.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      pane.style.background = formerBackground
      pane.style.backdropFilter = formerBackdrop
    }
  }, [side])
  return (
    <div ref={root} className={'voice-halo-flow voice-halo-flow-' + side} style={{ display: 'flow-root' }}>
      {ENABLED && <span className="voice-halo-float" aria-hidden="true" style={{ float: side === 'left' ? 'right' : 'left' }} />}
      {children}
    </div>
  )
}
