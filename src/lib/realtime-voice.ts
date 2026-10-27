import { BRIDGE_HTTP_URL } from '../config'
import { getMic } from './audio'

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
  signal,
}: {
  pin: string
  onState: (state: RealtimeState, message?: string) => void
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
  let clone: MediaStreamTrack | null = null
  let stopped = false
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const stop = () => {
    if (stopped) return
    stopped = true
    if (timer) clearTimeout(timer)
    channel.close()
    clone?.stop()
    playback.pause()
    playback.srcObject = null
    pc.close()
    if (!closed) {
      closed = true
      onState('closed')
    }
  }
  signal?.addEventListener('abort', stop, { once: true })
  const ensureActive = () => {
    if (stopped || signal?.aborted) throw new Error('Conexión cancelada.')
  }

  pc.ontrack = (event) => {
    if (stopped) return
    const remote = event.streams[0]
    if (remote) {
      playback.srcObject = remote
      void playback.play().catch(() => {
        if (!stopped) onState('error', 'Tu navegador bloqueó la reproducción. Permite el audio y vuelve a intentarlo.')
      })
    }
  }
  pc.onconnectionstatechange = () => {
    if (stopped) return
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      onState('error', 'Se perdió la conexión de voz en tiempo real.')
      stop()
    }
  }
  channel.onopen = () => {
    if (!stopped) onState('listening')
  }
  channel.onmessage = (event) => {
    if (stopped) return
    let data: { type?: string }
    try { data = JSON.parse(String(event.data)) } catch { return }
    // Deliberately ignore generated instructions and function calls: no bridge
    // from this session to the canonical agent's tool execution permissions.
    if (data.type === 'input_audio_buffer.speech_started') {
      onState('interrupted')
    } else if (data.type === 'response.created' ||
               data.type === 'response.output_audio.delta') {
      onState('speaking')
    } else if (data.type === 'response.done' ||
               data.type === 'output_audio_buffer.stopped') {
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
    pc.addTrack(clone)
    const auth = await fetch(BRIDGE_HTTP_URL + '/voice/realtime/client-secret', {
      method: 'POST',
      headers: { 'x-orbia-realtime-pin': pin, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal,
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
      signal,
    })
    ensureActive()
    if (!answer.ok) throw new Error('No se pudo establecer la llamada WebRTC.')
    const sdp = await answer.text()
    ensureActive()
    await pc.setRemoteDescription({ type: 'answer', sdp })
    ensureActive()

    const limit = Math.min(
      REALTIME_TRIAL_MAX_MS,
      Math.max(0, Math.round(Number(grant.maxTrialSeconds) * 1000) ||
        REALTIME_TRIAL_MAX_MS),
    )
    timer = setTimeout(stop, limit)
    return { stop }
  } catch (err) {
    stop()
    throw err
  }
}
