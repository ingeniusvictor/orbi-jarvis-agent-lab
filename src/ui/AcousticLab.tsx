import { useEffect, useRef, useState } from 'react'
import { getMic } from '../lib/audio'
import {
  acousticCheckSummary,
  acousticDbfs,
  acousticLevelPercent,
  acousticRms,
} from '../lib/acoustic-lab-metrics'

/**
 * No-cost, explicitly started Windows/Chrome audio-device self-check.
 *
 * Microphone samples are read ONLY into an in-memory analyser, not recorded.
 * The input source is NOT connected to the loudspeaker: feedback loops are
 * avoided. The short test tone is local WebAudio and uses no cloud provider.
 * The parent suspends the normal voice recognizer for the whole measurement.
 */
export function AcousticLab({
  available,
  onSuspendNormal,
  onResumeNormal,
}: {
  available: boolean
  onSuspendNormal: () => boolean
  onResumeNormal: () => void
}) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [dbfs, setDbfs] = useState(-100)
  const [peakDbfs, setPeakDbfs] = useState<number | null>(null)
  const [toneRequested, setToneRequested] = useState(false)
  const [heardTone, setHeardTone] = useState(false)
  const [status, setStatus] = useState('')
  const activeRef = useRef(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const frameRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const releaseResources = () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    const oscillator = oscillatorRef.current
    oscillatorRef.current = null
    if (oscillator) {
      try { oscillator.stop() } catch { /* already completed */ }
      oscillator.disconnect()
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
    trackRef.current?.stop()
    trackRef.current = null
    const ctx = ctxRef.current
    ctxRef.current = null
    if (ctx) void ctx.close().catch(() => {})
  }

  const stop = () => {
    if (!activeRef.current) return
    activeRef.current = false
    releaseResources()
    setRunning(false)
    onResumeNormal()
  }

  useEffect(() => () => {
    // Unmount is not permission to restart a parent that is itself unloading.
    activeRef.current = false
    releaseResources()
    // The ref-owned AudioContext and tracks are the only retained resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const begin = async () => {
    if (activeRef.current || !available) return
    if (!onSuspendNormal()) {
      setStatus('Hay otra prueba de voz activa; termínala antes de continuar.')
      return
    }
    activeRef.current = true
    setRunning(true)
    setDbfs(-100)
    setPeakDbfs(null)
    setHeardTone(false)
    setToneRequested(false)
    setStatus('Solicitando micrófono. Habla durante unos segundos.')
    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      await ctx.resume()
      if (!activeRef.current) return
      const stream = await getMic()
      if (!activeRef.current) return
      const track = stream.getAudioTracks().find((t) => t.readyState === 'live')
      if (!track) throw new Error('No hay una entrada de micrófono activa.')
      const clone = track.clone()
      trackRef.current = clone
      const input = ctx.createMediaStreamSource(new MediaStream([clone]))
      sourceRef.current = input
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.25
      input.connect(analyser) // Do not connect mic input to ctx.destination.
      const data = new Float32Array(analyser.fftSize)
      let lastUpdate = 0
      const tick = (now: number) => {
        if (!activeRef.current) return
        analyser.getFloatTimeDomainData(data)
        const sampleDb = acousticDbfs(acousticRms(data))
        if (now - lastUpdate > 150) {
          lastUpdate = now
          setDbfs(sampleDb)
          setPeakDbfs((p) => Math.max(p ?? -100, sampleDb))
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
      timeoutRef.current = setTimeout(() => {
        if (activeRef.current) {
          setStatus('La prueba alcanzó el límite local de 45 segundos.')
          stop()
        }
      }, 45_000)
      setStatus('Micrófono abierto solo para medir nivel. Habla normalmente.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo abrir el micrófono.')
      stop()
    }
  }

  const playTone = () => {
    const ctx = ctxRef.current
    if (!activeRef.current || !ctx || ctx.state !== 'running') return
    if (oscillatorRef.current) return
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 440
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.46)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillatorRef.current = oscillator
    oscillator.onended = () => {
      if (oscillatorRef.current === oscillator) oscillatorRef.current = null
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.5)
    setToneRequested(true)
    setHeardTone(false)
  }

  if (!open) return (
    <button type="button" disabled={!available} onClick={() => setOpen(true)}
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 251,
        padding: '10px 16px', borderRadius: 18, cursor: 'pointer',
        border: '1px solid #3e8c96', background: '#092b36',
        color: '#c7fbff', font: '600 12px system-ui',
      }}>
      LUMIA · LAB ACÚSTICO
    </button>
  )

  const peak = peakDbfs === null ? '—' : peakDbfs.toFixed(1) + ' dBFS'
  const summary = acousticCheckSummary({
    micPeakDbfs: peakDbfs,
    toneRequested,
    toneHeardConfirmed: heardTone,
  })
  return (
    <section aria-label="Laboratorio acústico local de LUMIA"
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 251,
        width: 340, maxWidth: 'calc(100vw - 32px)',
        padding: 18, borderRadius: 20, border: '1px solid #3e8c96',
        background: '#071c28', color: '#e5faff',
        boxShadow: '0 12px 32px #0009', font: '13px/1.55 system-ui',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>LUMIA · AUDIO LOCAL / SIN GASTOS</strong>
        <button type="button" aria-label="Cerrar laboratorio acústico"
          onClick={() => { stop(); setOpen(false) }}
          style={{ color: '#e5faff', background: 'transparent',
            border: 0, fontSize: 18, cursor: 'pointer' }}>×</button>
      </div>
      <p>Prueba la entrada de micrófono y escucha un tono breve por tus altavoces.
        El reconocimiento normal queda detenido durante la prueba.</p>
      <p style={{ color: '#9dc6d0' }}>
        No se graba ni transmite audio. La prueba se cierra a los 45 segundos;
        no certifica por sí sola la latencia conversacional.
      </p>
      <div role="status" aria-live="polite">{status || 'Pulsa iniciar cuando estés preparado.'}</div>
      <div style={{ marginTop: 12 }}>
        <div>Nivel de micrófono: {dbfs.toFixed(1)} dBFS</div>
        <div role="meter" aria-label="Nivel del micrófono" aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={acousticLevelPercent(dbfs)}
          style={{ background: '#234452', height: 9, borderRadius: 5 }}>
          <div style={{
            height: '100%', borderRadius: 5, background: '#45bed0',
            width: acousticLevelPercent(dbfs) + '%',
          }} />
        </div>
        <div>Pico observado: {peak}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={running || !available}
          onClick={() => void begin()}>Iniciar micrófono</button>
        <button type="button" disabled={!running}
          onClick={playTone}>Reproducir tono 0,5 s</button>
        <button type="button" disabled={!running}
          onClick={stop}>Terminar</button>
      </div>
      {toneRequested && (
        <label style={{ display: 'block', marginTop: 10 }}>
          <input type="checkbox" checked={heardTone}
            onChange={(e) => setHeardTone(e.target.checked)}/>
          Confirmo que escuché el tono por los altavoces
        </label>
      )}
      <div style={{ marginTop: 12 }}>
        Micrófono con nivel observado: {summary.micAboveFloor ? 'SÍ' : 'SIN CONFIRMAR'}
        {' · '} Tono escuchado: {summary.toneHeardConfirmed ? 'SÍ' : 'SIN CONFIRMAR'}
      </div>
      <button type="button" onClick={() => {
        void navigator.clipboard.writeText(JSON.stringify({
          phase: 'VL-06-ACOUSTIC', ...summary,
        }, null, 2)).catch(() =>
          setStatus('No fue posible copiar el resumen numérico.'),
        )
      }} style={{ marginTop: 10 }}>
        Copiar resultado sin audio
      </button>
    </section>
  )
}
