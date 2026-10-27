import { useCallback, useEffect, useRef, useState } from 'react'
import {
  startRealtimeVoiceTrial,
  type RealtimeCall,
  type RealtimeState,
} from '../lib/realtime-voice'
import { type RealtimeTurnStats } from '../lib/realtime-turn-metrics'

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
  const [metrics, setMetrics] = useState<RealtimeTurnStats>({
    count: 0, lastMs: null, medianMs: null, p95Ms: null, interrupted: 0,
  })
  const active = useRef<RealtimeCall | null>(null)
  const aborting = useRef<AbortController | null>(null)
  const suspended = useRef(false)
  const stopping = useRef(false)

  const stop = useCallback(() => {
    // Aborting a handshake synchronously invokes its "closed" callback.
    // Mark recovery before aborting so nested callbacks cannot start two
    // microphone/Whisper loops or restore an already-ended conversation.
    if (stopping.current) return
    stopping.current = true
    const shouldResume = suspended.current
    suspended.current = false
    const controller = aborting.current
    aborting.current = null
    const call = active.current
    active.current = null
    try {
      controller?.abort()
      call?.stop()
      setState('closed')
      if (shouldResume) onResumeNormal()
    } finally {
      stopping.current = false
    }
  }, [onResumeNormal])

  useEffect(() => () => {
    aborting.current?.abort()
    active.current?.stop()
  }, [])

  const start = async () => {
    if (state !== 'closed' || pin.trim().length < 12 || !available) return
    setMessage('')
    setMetrics({ count: 0, lastMs: null, medianMs: null, p95Ms: null, interrupted: 0 })
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
        onMetrics: setMetrics,
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
      <div aria-label="Métricas de latencia WebRTC" style={{
        background: '#0d2a36', borderRadius: 10, padding: 10, marginTop: 10,
      }}>
        <strong>Mediciones de turnos (sin grabaciones)</strong>
        <div>Muestras: {metrics.count} · Interrupciones: {metrics.interrupted}</div>
        <div>Última: {metrics.lastMs == null ? '—' : metrics.lastMs + ' ms'}</div>
        <div>Mediana: {metrics.medianMs == null ? '—' : metrics.medianMs + ' ms'}</div>
        <div>P95: {metrics.p95Ms == null ? '—' : metrics.p95Ms + ' ms'}</div>
        <small style={{ color: '#9dc6d0' }}>
          Desde detección de fin de voz hasta que el servidor comienza a enviar
          audio; NO mide el primer sonido audible en el parlante.
        </small>
        {metrics.count > 0 && (
          <button type="button" onClick={() => {
            const summary = JSON.stringify({
              phase: 'VL-06', clock: 'WebRTC data-channel proxy',
              ...metrics,
              containsAudioOrTranscript: false,
            }, null, 2)
            void navigator.clipboard.writeText(summary).catch(() =>
              setMessage('No pude copiar automáticamente las métricas.'),
            )
          }} style={{
            display: 'block', marginTop: 8, background: '#163e4e',
            color: '#e5faff', padding: '5px 9px', border: '1px solid #437986',
            borderRadius: 8, cursor: 'pointer',
          }}>Copiar resumen sin datos privados</button>
        )}
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
