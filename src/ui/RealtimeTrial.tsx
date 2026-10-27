import { useCallback, useEffect, useRef, useState } from 'react'
import {
  startRealtimeVoiceTrial,
  type RealtimeCall,
  type RealtimeState,
} from '../lib/realtime-voice'

/**
 * Deliberately distinct from LUMIA's normal microphone and command loop.
 * A visible, manual opt-in is mandatory; no wake word starts a paid session.
 */
export function RealtimeTrial({
  available,
  onSuspendNormal,
  onResumeNormal,
}: {
  available: boolean
  onSuspendNormal: () => void
  onResumeNormal: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [state, setState] = useState<RealtimeState>('closed')
  const [message, setMessage] = useState('')
  const active = useRef<RealtimeCall | null>(null)
  const aborting = useRef<AbortController | null>(null)
  const suspended = useRef(false)

  const stop = useCallback(() => {
    aborting.current?.abort()
    aborting.current = null
    active.current?.stop()
    active.current = null
    setState('closed')
    if (suspended.current) {
      suspended.current = false
      onResumeNormal()
    }
  }, [onResumeNormal])

  useEffect(() => () => {
    aborting.current?.abort()
    active.current?.stop()
  }, [])

  const start = async () => {
    if (state !== 'closed' || pin.trim().length < 12 || !available) return
    setMessage('')
    setPin('') // Never retain the owner PIN in component state after submission.
    const submittedPin = pin.trim()
    const controller = new AbortController()
    aborting.current = controller
    suspended.current = true
    onSuspendNormal()
    setState('connecting')
    try {
      const result = await startRealtimeVoiceTrial({
        pin: submittedPin,
        signal: controller.signal,
        onState: (next, note) => {
          if (note) setMessage(note)
          if (next === 'closed') stop()
          else setState(next)
        },
      })
      if (controller.signal.aborted) result.stop()
      else active.current = result
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : 'No se pudo conectar.')
      }
      stop()
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!available}
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 250,
          padding: '10px 16px', borderRadius: 18,
          color: '#c7fbff', background: '#092b36',
          border: '1px solid #3e8c96', cursor: 'pointer',
          font: '600 12px system-ui',
        }}
      >
        LUMIA · VOZ REALTIME
      </button>
    )
  }

  const inSession = state !== 'closed'
  return (
    <section
      aria-label="Piloto de voz en tiempo real de LUMIA"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 250,
        width: 340, maxWidth: 'calc(100vw - 32px)', padding: 18,
        borderRadius: 20, background: '#071c28', color: '#e5faff',
        border: '1px solid #3e8c96', boxShadow: '0 12px 32px #0009',
        font: '13px/1.55 system-ui',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>LUMIA · REALTIME EXPERIMENTAL</strong>
        <button
          type="button"
          onClick={() => { stop(); setOpen(false) }}
          style={{ color: '#e5faff', background: 'none', border: 0, cursor: 'pointer', fontSize: 18 }}
          aria-label="Cerrar piloto"
        >×</button>
      </div>
      <p style={{ margin: '10px 0' }}>
        Conversación de voz bidireccional, solo para hablar.
        No controla herramientas ni ejecuta tareas.
      </p>
      <p style={{ color: '#f8c989', margin: '8px 0' }}>
        Requiere una clave OpenAI API de pago configurada en tu servidor.
        Prueba limitada a 90 segundos por llamada y 2 intentos por arranque.
        El límite de interfaz no sustituye un presupuesto de facturación.
      </p>
      <div role="status" aria-live="polite">
        Estado: {state === 'closed' ? 'desconectada' :
          state === 'connecting' ? 'conectando…' :
            state === 'listening' ? 'escuchando' :
              state === 'speaking' ? 'hablando' :
                state === 'interrupted' ? 'detectando voz' : 'error'}
      </div>
      {!inSession && (
        <label style={{ display: 'block', marginTop: 12 }}>
          PIN privado configurado en el bridge
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="off"
            placeholder="PIN de 12 caracteres o más"
            style={{
              display: 'block', marginTop: 6, padding: 9, width: '100%',
              background: '#102e3b', border: '1px solid #4b8794',
              borderRadius: 8, color: '#fff',
            }}
          />
        </label>
      )}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          disabled={!available || (!inSession && pin.trim().length < 12)}
          onClick={() => { if (inSession) stop(); else void start() }}
          style={{
            background: inSession ? '#834541' : '#176472', border: 0,
            color: 'white', cursor: 'pointer', padding: '10px 16px', borderRadius: 9,
          }}
        >
          {inSession ? 'Terminar llamada' : 'Iniciar prueba autorizada'}
        </button>
      </div>
      {message && <p role="alert" style={{ color: '#f8c989', marginTop: 8 }}>{message}</p>}
    </section>
  )
}
