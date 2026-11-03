import { useEffect, useState } from 'react'
import {
  avatarPresenceSnapshot,
  setLumiaAvatarView,
  subscribeAvatarPresence,
  type LumiaAvatarView,
} from '../scene/lumia-motion-r8/avatar-presence-ph04'

const views = [
  { key: 'head-vrm', label: 'ROSTRO', title: 'Solo rostro' },
  { key: 'bust-vrm', label: 'MEDIO', title: 'Medio cuerpo · vista principal' },
  { key: 'body-vrm', label: 'CUERPO', title: 'Cuerpo completo' },
] as const

/** Manual alternative to speaking commands, without reloading the browser. */
export function LumiaViewDock() {
  const [view, setView] = useState<LumiaAvatarView>(() => avatarPresenceSnapshot().view)
  useEffect(() => subscribeAvatarPresence(() => setView(avatarPresenceSnapshot().view)), [])
  return (
    <nav
      aria-label="Vistas del avatar virtual de LUMIA"
      style={{
        position: 'fixed', right: '5.2%', top: '8.8rem', zIndex: 12,
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 7px', border: '1px solid rgba(83,235,255,.18)',
        borderRadius: 14, background: 'rgba(1,14,22,.62)',
        boxShadow: '0 0 18px rgba(5,140,160,.08)',
      }}
    >
      {views.map((item) => {
        const active = view === item.key
        return (
          <button
            type="button"
            key={item.key}
            title={item.title}
            aria-pressed={active}
            onClick={() => setLumiaAvatarView(item.key)}
            style={{
              borderRadius: 9, cursor: 'pointer', padding: '5px 8px',
              font: '600 9px ui-monospace, monospace', letterSpacing: '.12em',
              border: '1px solid ' + (active ? 'rgba(82,225,246,.70)' : 'transparent'),
              color: active ? '#b7f8ff' : '#5d929b',
              background: active ? 'rgba(31,170,193,.14)' : 'transparent',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
