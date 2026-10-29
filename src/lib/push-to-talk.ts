/**
 * UX-01: user-initiated audio only, no permanent recorder, no cloud calls.
 * The WAV goes to the already-protected local Whisper endpoint in App.tsx.
 */
import { getMic } from './audio'

export const PUSH_CAPTURE_MAX_MS = 20_000
export type PushCapture = {
  stop: () => Promise<Blob>
  cancel: () => void
}
export async function startPushCapture(): Promise<PushCapture> {
  const stream = await getMic()
  if (typeof MediaRecorder === 'undefined') throw new Error('El navegador no permite grabar audio.')
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((candidate) => MediaRecorder.isTypeSupported(candidate))
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
  const chunks: BlobPart[] = []
  let closed = false
  let resolveResult: (value: Blob) => void = () => {}
  let rejectResult: (error: Error) => void = () => {}
  const result = new Promise<Blob>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data) }
  recorder.onstop = () => {
    if (closed) return
    closed = true
    const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' })
    if (blob.size) resolveResult(blob)
    else rejectResult(new Error('No se recibió audio del micrófono.'))
  }
  recorder.onerror = () => {
    if (closed) return
    closed = true
    rejectResult(new Error('Falló la grabación local.'))
  }
  recorder.start()
  const stop = () => {
    if (recorder.state === 'recording') recorder.stop()
    return result
  }
  return {
    stop,
    cancel: () => {
      if (closed) return
      closed = true
      recorder.onstop = null
      if (recorder.state === 'recording') recorder.stop()
      resolveResult(new Blob([]))
    },
  }
}
