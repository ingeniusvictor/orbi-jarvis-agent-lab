import { BRIDGE_HTTP_URL } from '../config'
import { getMic } from './audio'
import { createRealtimeTurnMeter, type RealtimeTurnStats } from './realtime-turn-metrics'

/**
 * VL-05: isolated speech-to-speech trial, NOT the canonical LUMIA brain.
 * This WebRTC connection cannot call local tools, control the app or authorize
 * writes. It is launched by an explicit user action with an owner PIN.
 */
export type RealtimeState =
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'interrupted'
  | 'closed'
  | 'error'

export type RealtimeCall = {
  stop: () => void
}

export const REALTIME_TRIAL_MAX_MS = 90_000

export function isRealtimePilotUiEnabled(): boolean {
  return import.meta.env.VITE_LUMIA_REALTIME_EXPERIMENT === '1'
}

export async function startRealtimeVoiceTrial({
  pin,
  onState,
  onMetrics,
  signal,
}: {
  pin: string
  onState: (state: RealtimeState, message?: string) => void
  onMetrics?: (stats: RealtimeTurnStats) => void
  signal?: AbortSignal
}): Promise<RealtimeCall> {
  if (!isRealtimePilotUiEnabled() || typeof pin !== 'string' || pin.length < 12) {
    throw new Error('Activa el piloto local y utiliza el PIN privado del servidor.')
  }
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('Tu navegador no admite WebRTC.')
  }
  if (signal?.aborted) throw new Error('Conexión cancelada.')

  const pc = new RTCPeerConnection()
  const playback = new Audio()
  playback.autoplay = true
  const channel = pc.createDataChannel('oai-events')
  const metrics = createRealtimeTurnMeter((stats) => onMetrics?.(stats))
  let clone: MediaStreamTrack | null = null
  let stopped = false
  let closed = false
  // Bound total trial life from the first click, not from the *end* of the
  // handshake. This prevents an indefinite chargeable connection when SDP or
  // device setup stalls. The pilot does NOT guarantee provider-side billing
  // termination; the owner's API project limit remains essential.
  const sessionAbort = new AbortController()
  let trialTimer: ReturnType<typeof setTimeout> | null = null
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null
  let disconnectedTimer: ReturnType<typeof setTimeout> | null = null

  const stop = () => {
    if (stopped) return
    stopped = true
    sessionAbort.abort()
    signal?.removeEventListener('abort', stop)
    if (trialTimer) clearTimeout(trialTimer)
    if (handshakeTimer) clearTimeout(handshakeTimer)
    if (disconnectedTimer) clearTimeout(disconnectedTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', stop)
    try { channel.close() } catch { /* already closed */ }
    clone?.stop()
    playback.pause()
    playback.srcObject = null
    pc.close()
    if (!closed) {
      closed = true
      onState('closed')
    }
  }
  const fail = (message: string) => {
    if (stopped) return
    onState('error', message)
    stop()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') stop()
  }
  signal?.addEventListener('abort', stop, { once: true })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', stop, { once: true })
  trialTimer = setTimeout(stop, REALTIME_TRIAL_MAX_MS)
  handshakeTimer = setTimeout(() => {
    fail('La conexión tardó demasiado. Cerré el micrófono y volví a LUMIA local.')
  }, 20_000)
  const ensureActive = () => {
    if (stopped || signal?.aborted) throw new Error('Conexión cancelada.')
  }

  pc.ontrack = (event) => {
    if (stopped) return
    const remote = event.streams[0]
    if (remote) {
      playback.srcObject = remote
      void playback.play().catch(() => {
        fail('Tu navegador bloqueó la reproducción. Permite el audio y vuelve a intentarlo.')
      })
    }
  }
  pc.onconnectionstatechange = () => {
    if (stopped) return
    const state = pc.connectionState
    if (state === 'failed' || state === 'closed') {
      fail('Se perdió la conexión de voz en tiempo real.')
    } else if (state === 'disconnected' && !disconnectedTimer) {
      // Wi-Fi handover can briefly disconnect without an actual failure.
      disconnectedTimer = setTimeout(() => {
        disconnectedTimer = null
        if (!stopped && pc.connectionState === 'disconnected') {
          fail('La conexión no se recuperó. Regresé a la voz local.')
        }
      }, 5000)
    } else if (state === 'connected' && disconnectedTimer) {
      clearTimeout(disconnectedTimer)
      disconnectedTimer = null
    }
  }
  channel.onopen = () => {
    if (!stopped) onState('listening')
  }
  channel.onclose = () => {
    if (!stopped) fail('Se cerró el canal Realtime. Regresé a la voz habitual.')
  }
  channel.onmessage = (event) => {
    if (stopped) return
    let data: { type?: string }
    try { data = JSON.parse(String(event.data)) } catch { return }
    if (typeof data.type === 'string') metrics.onEvent(data.type)
    // Deliberately ignore generated instructions and function calls: no bridge
    // from this session to the canonical agent's tool execution permissions.
    if (data.type === 'input_audio_buffer.speech_started') {
      onState('interrupted')
    } else if (data.type === 'output_audio_buffer.started' ||
               data.type === 'response.created' ||
               data.type === 'response.output_audio.delta') {
      onState('speaking')
    } else if (data.type === 'output_audio_buffer.stopped' ||
               data.type === 'output_audio_buffer.cleared') {
      onState('listening')
    } else if (data.type === 'error') {
      onState('error', 'El servicio de voz notificó un error.')
    }
  }

  try {
    onState('connecting')
    // A separate track avoids disrupting the shared microphone stream that
    // the normal LUMIA voice loop will reuse after this trial ends.
    const mic = await getMic()
    ensureActive()
    const track = mic.getAudioTracks()[0]
    if (!track) throw new Error('No hay una pista de micrófono disponible.')
    clone = track.clone()
    // Stopping a shared device is not the same as intentionally ending this
    // session. When Windows removes a headset or microphone, the cloned track
    // may end even though WebRTC still reports "connected". Stop promptly
    // rather than leaving a billable call silently active.
    clone.addEventListener('ended', () => {
      fail('El micrófono se desconectó. Cerré la llamada Realtime.')
    }, { once: true })
    pc.addTrack(clone)
    const auth = await fetch(BRIDGE_HTTP_URL + '/voice/realtime/client-secret', {
      method: 'POST',
      headers: { 'x-orbia-realtime-pin': pin, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: sessionAbort.signal,
    })
    ensureActive()
    if (!auth.ok) {
      const reason = auth.status === 429
        ? 'El piloto alcanzó el límite de sesiones de este arranque.'
        : 'El piloto no está autorizado o la clave de API no está configurada.'
      throw new Error(reason)
    }
    const grant = await auth.json() as {
      clientSecret?: string
      maxTrialSeconds?: number
    }
    ensureActive()
    if (!grant.clientSecret?.startsWith('ek_')) {
      throw new Error('Credencial temporal inválida.')
    }

    const offer = await pc.createOffer()
    ensureActive()
    await pc.setLocalDescription(offer)
    ensureActive()
    const answer = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + grant.clientSecret,
        'Content-Type': 'application/sdp',
      },
      body: pc.localDescription?.sdp ?? offer.sdp,
      signal: sessionAbort.signal,
    })
    ensureActive()
    if (!answer.ok) throw new Error('No se pudo establecer la llamada WebRTC.')
    const sdp = await answer.text()
    ensureActive()
    await pc.setRemoteDescription({ type: 'answer', sdp })
    ensureActive()
    // The 90s lifetime has already been ticking since before requesting mic
    // access, secrets and SDP. Never reset it when connection succeeds.
    if (handshakeTimer) {
      clearTimeout(handshakeTimer)
      handshakeTimer = null
    }
    return { stop }
  } catch (err) {
    stop()
    throw err
  }
}
