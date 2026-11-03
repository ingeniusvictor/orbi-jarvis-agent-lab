import { useEffect, useRef, useState } from 'react'
import {
  avatarPresenceSnapshot,
  setLumiaAvatarView,
  subscribeAvatarPresence,
  type LumiaAvatarView,
} from '../scene/lumia-motion-r8/avatar-presence-ph04'

const views = [
  { key: 'head-vrm', label: 'Solo rostro', symbol: '◉' },
  { key: 'bust-vrm', label: 'Medio cuerpo', symbol: '◉' },
  { key: 'body-vrm', label: 'Cuerpo completo', symbol: '◉' },
] as const

/** PH-04.3: one compact avatar-view control inside the EXISTING chat dock. */
export function LumiaViewDock() {
  const [view, setView] = useState<LumiaAvatarView>(() => avatarPresenceSnapshot().view)
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => subscribeAvatarPresence(() => {
    setView(avatarPresenceSnapshot().view)
    setOpen(false)
  }), [])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  const active = views.find((item) => item.key === view)
  return (
    <div className="lumia-avatar-view-picker" ref={container}>
      <button
        type="button"
        className={'lumia-composer-icon-button lumia-avatar-view-trigger' + (open ? ' is-active' : '')}
        aria-label={'Cambiar vista del avatar. Actual: ' + (active?.label ?? 'Avatar anterior')}
        aria-expanded={open}
        aria-haspopup="true"
        title={'Vista del avatar · ' + (active?.label ?? 'Avatar anterior')}
        onClick={() => setOpen((current) => !current)}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" fill="none" opacity=".65" />
          <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <path d="M5.5 19c.65-4.1 3.3-6.1 6.5-6.1s5.85 2 6.5 6.1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="lumia-avatar-view-options" role="group" aria-label="Selecciona la vista de LUMIA">
          <span className="lumia-avatar-view-title">VISTA DEL AVATAR</span>
          {views.map((item) => (
            <button
              key={item.key}
              type="button"
              className={'lumia-avatar-view-option' + (view === item.key ? ' is-selected' : '')}
              aria-pressed={view === item.key}
              onClick={() => {
                setLumiaAvatarView(item.key)
                setOpen(false)
              }}
            >
              <span aria-hidden="true">{item.symbol}</span>
              <span>{item.label}</span>
              {view === item.key && <span className="lumia-avatar-view-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
