import { useEffect, useRef, type ReactNode } from 'react'

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
    let frame = 0
    let disposed = false
    let previous = ''
    const layout = () => {
      frame = 0
      if (disposed) return
      const rect = element.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const radius = Math.min(vh * 0.355, vw * 0.245) + 16
      const centerX = vw / 2
      const centerY = vh * 0.49
      const edge = side === 'left' ? rect.right : rect.left
      const overlap = side === 'left'
        ? Math.max(0, edge - (centerX - radius))
        : Math.max(0, centerX + radius - edge)
      const width = Math.min(overlap, Math.max(0, rect.width - 175))
      const visible = vw >= 1201 && rect.width >= 190 &&
        rect.top < centerY + radius && rect.bottom > centerY - radius && width > 0
      if (!visible) {
        if (previous !== 'off') {
          spacer.style.width = '0px'
          spacer.style.height = '0px'
          spacer.style.shapeOutside = 'none'
          previous = 'off'
        }
        return
      }
      const childEnds = Array.from(element.children)
        .filter(child => child !== spacer)
        .map(child => child.getBoundingClientRect().bottom - rect.top)
      const height = Math.max(0, Math.min(
        centerY + radius - rect.top, Math.max(28, ...childEnds) + 5, 2 * radius,
      ))
      const cx = side === 'left' ? centerX - (rect.right - width) : centerX - rect.left
      const cy = centerY - rect.top
      const shape = 'circle(' + radius.toFixed(1) + 'px at ' +
        cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px)'
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
    }
  }, [side])
  return (
    <div ref={root} className={'voice-halo-flow voice-halo-flow-' + side}>
      {ENABLED && <span className="voice-halo-float" aria-hidden="true" />}
      {children}
    </div>
  )
}
