import { useEffect, useRef, useState } from 'react'
import { motionCatalog } from '../scene/lumia-motion-r8/motion-library-catalog.js'
import {
  requestLumiaAvatarMotion, resumeLumiaAvatarMotion,
} from '../scene/lumia-motion-r8/avatar-presence-ph04'

const groups = [
  { id: 'conversacion', label: 'CONVERSACIÓN' },
  { id: 'emociones', label: 'EMOCIONES Y GESTOS' },
  { id: 'movimiento', label: 'MOVIMIENTO CORPORAL' },
] as const

/** PH-04.7 — Second button from the left, between Avatar and Image.
 * Every manual gesture addresses only an owner-approved local R8 catalog ID.
 * No new FBX imports, text generation or system/UI permissions.
 */
export function LumiaMotionDock({
  busy, onDemo,
}: {
  busy: boolean
  onDemo: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [warning, setWarning] = useState('')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', escape)
    }
  }, [open])
  useEffect(() => {
    if (busy) setOpen(false)
  }, [busy])

  const play = (id: string) => {
    if (busy) return
    if (new URLSearchParams(window.location.search).get('lumiaR8') === 'procedural') {
      setWarning('El respaldo procedural no reproduce FBX. Abre la vista normal.')
      return
    }
    if (!motionCatalog.some(item => item.id === id)) {
      setWarning('Movimiento no incluido en Motion R8.')
      return
    }
    if (requestLumiaAvatarMotion(id)) {
      setSelected(id)
      setWarning('')
      setOpen(false)
    }
  }

  return (
    <div className="lumia-avatar-view-picker lumia-motion-picker" ref={root}>
      <button
        type="button"
        className={'lumia-composer-icon-button lumia-motion-trigger' + (open ? ' is-active' : '')}
        aria-label="Abrir catálogo de 17 animaciones Motion R8"
        aria-expanded={open}
        aria-haspopup="true"
        title={selected
          ? 'Animaciones Motion R8 · última orden: ' + (motionCatalog.find(x => x.id === selected)?.label ?? selected)
          : 'Animaciones Motion R8 · elegir gesto'}
        disabled={busy}
        onClick={() => { setWarning(''); setOpen(value => !value) }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="5" width="18" height="14" rx="3" fill="none"
            stroke="currentColor" strokeWidth="1.35"/>
          <circle cx="12" cy="9" r="1.7" stroke="currentColor"
            strokeWidth="1.3" fill="none"/>
          <path d="m8 16 2.1-3.6 2.7 2 2.4-3.2L17 16" fill="none"
            stroke="currentColor" strokeWidth="1.35"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="lumia-motion-options" role="group" aria-label="Catálogo de animaciones Motion R8">
          <div className="lumia-motion-menu-head">
            <span>ANIMACIONES · MOTION R8</span>
            <span>17</span>
          </div>
          <button type="button" className="lumia-motion-special"
            onClick={() => {setOpen(false); onDemo()}}>
            <span aria-hidden="true">▶</span>
            Demostración guiada completa
          </button>
          <div className="lumia-motion-menu-scroll">
            {groups.map(group => (
              <div className="lumia-motion-group" key={group.id}>
                <div className="lumia-motion-group-title">{group.label}</div>
                {motionCatalog.filter(clip => clip.category === group.id).map(clip => (
                  <button
                    key={clip.id}
                    type="button"
                    className={'lumia-avatar-view-option lumia-motion-option' +
                      (selected === clip.id ? ' is-selected' : '')}
                    title={'Ejecutar FBX local: ' + clip.file}
                    onClick={() => play(clip.id)}
                  >
                    <span className="lumia-motion-play-icon" aria-hidden="true">▸</span>
                    <span>{clip.label}</span>
                    {selected === clip.id &&
                      <span className="lumia-avatar-view-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="lumia-motion-auto"
            onClick={() => {resumeLumiaAvatarMotion(); setSelected(null); setOpen(false)}}>
            <span aria-hidden="true">↺</span> Volver a gestos automáticos
          </button>
          <div className="lumia-motion-footnote">
            Reproduce clips FBX locales; no genera videos nuevos.
          </div>
        </div>
      )}
      {warning && <span className="lumia-motion-warning" role="status">{warning}</span>}
    </div>
  )
}
