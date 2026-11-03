import { useEffect, useState } from 'react'
import { guidedDemoSnapshot, subscribeGuidedDemo } from '../scene/lumia-motion-r8/avatar-demo-ph045'

/** PH-04.5: visible, interruptible owner-authorized guided demo. */
export function LumiaDemoIndicator({ onStop }: { onStop: () => void }) {
  const [demo, setDemo] = useState(() => guidedDemoSnapshot())
  useEffect(() => subscribeGuidedDemo(() => setDemo(guidedDemoSnapshot())), [])
  if (!demo.active) return null
  return (
    <aside
      aria-label="Demostración de animaciones Motion R8"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: '96px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 32, display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 11px', borderRadius: 15,
        border: '1px solid rgba(104,228,245,.43)',
        background: 'rgba(2,22,33,.92)', color: '#c5f9ff',
        boxShadow: '0 7px 24px rgba(0,0,0,.45)', maxWidth: 'min(92vw,610px)',
        font: '11px system-ui, sans-serif',
      }}
    >
      <span style={{whiteSpace:'nowrap', fontWeight:650, letterSpacing:'.06em'}}>
        DEMO R8 · {Math.max(0,demo.completed)}/{demo.total}
      </span>
      <span style={{
        opacity:.77, overflow:'hidden', textOverflow:'ellipsis',
        whiteSpace:'nowrap', minWidth:50, maxWidth:300,
      }}>{demo.current || 'Preparando recorrido...'}</span>
      <button
        type="button"
        aria-label="Detener demostración de animaciones"
        title="Detener demostración"
        onClick={onStop}
        style={{
          cursor:'pointer', color:'#cefbff', background:'rgba(65,186,212,.18)',
          border:'1px solid rgba(129,235,245,.5)', borderRadius:8,
          padding:'6px 9px', flexShrink:0,
        }}
      >Detener</button>
    </aside>
  )
}
