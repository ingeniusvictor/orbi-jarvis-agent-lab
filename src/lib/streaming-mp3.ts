/**
 * L.U.M.I.A. VL-04 — optional incremental MP3 playback.
 *
 * The bridge /tts endpoint already streams audio/mpeg. Media Source Extensions
 * let the browser start audio playback before the entire response body arrives.
 * Feature-detect the codec; unsupported browsers keep the full-Blob path.
 *
 * This module owns no credentials, microphone, voice profile or tool authority.
 * Always release the returned handle on completion and on interruption.
 */

const MP3_MIME = 'audio/mpeg'
const MAX_STREAM_BYTES = 4 * 1024 * 1024

export type StreamedAudio = Readonly<{
  url: string
  streaming: true
  dispose: () => void
}>

export type StreamCallbacks = {
  onChunk?: (bytes: number) => void
  onFailure?: () => void
}

export function supportsStreamingMp3(): boolean {
  return (
    typeof MediaSource !== 'undefined' &&
    typeof MediaSource.isTypeSupported === 'function' &&
    MediaSource.isTypeSupported(MP3_MIME) &&
    typeof URL.createObjectURL === 'function'
  )
}

/** Append in sequence: MSE SourceBuffer rejects concurrent appendBuffer calls. */
function appendChunk(buffer: SourceBuffer, bytes: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const detach = () => {
      buffer.removeEventListener('updateend', onEnd)
      buffer.removeEventListener('error', onError)
      buffer.removeEventListener('abort', onAbort)
    }
    const onEnd = () => { detach(); resolve() }
    const onError = () => { detach(); reject(new Error('MP3_BUFFER_ERROR')) }
    const onAbort = () => { detach(); reject(new Error('MP3_BUFFER_ABORTED')) }

    buffer.addEventListener('updateend', onEnd)
    buffer.addEventListener('error', onError)
    buffer.addEventListener('abort', onAbort)
    try {
      buffer.appendBuffer(bytes as Uint8Array<ArrayBuffer>)
    } catch {
      detach()
      reject(new Error('MP3_BUFFER_APPEND_FAILED'))
    }
  })
}

/**
 * Returns null without consuming the response if MSE is unavailable.
 * Otherwise returns a media URL immediately; the read/append loop begins only
 * when an audio element attaches the MediaSource and fires "sourceopen".
 */
export function createStreamingMp3(
  response: Response,
  callbacks: StreamCallbacks = {},
): StreamedAudio | null {
  if (!response.ok || !response.body || !supportsStreamingMp3()) return null
  if (!response.headers.get('content-type')?.toLowerCase().startsWith(MP3_MIME)) {
    return null
  }

  const media = new MediaSource()
  const url = URL.createObjectURL(media)
  let disposed = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let sourceBuffer: SourceBuffer | null = null

  const dispose = () => {
    if (disposed) return
    disposed = true
    media.removeEventListener('sourceopen', start)
    if (sourceBuffer?.updating && media.readyState === 'open') {
      try { sourceBuffer.abort() } catch { /* shutdown race */ }
    }
    if (reader) {
      void reader.cancel().catch(() => {})
    } else if (response.body && !response.body.locked) {
      void response.body.cancel().catch(() => {})
    }
    URL.revokeObjectURL(url)
  }

  const consume = async () => {
    try {
      if (disposed || media.readyState !== 'open') return
      sourceBuffer = media.addSourceBuffer(MP3_MIME)
      reader = response.body!.getReader()
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (disposed) return
        if (done) break
        if (!value?.byteLength) continue
        total += value.byteLength
        if (total > MAX_STREAM_BYTES) throw new Error('MP3_STREAM_TOO_LARGE')
        await appendChunk(sourceBuffer, value)
        if (disposed) return
        callbacks.onChunk?.(value.byteLength)
      }
      if (media.readyState === 'open' && !sourceBuffer.updating) {
        media.endOfStream()
      }
    } catch {
      if (disposed) return
      callbacks.onFailure?.()
      if (media.readyState === 'open') {
        try { media.endOfStream('network') } catch { /* closed by audio */ }
      }
    }
  }

  function start() {
    if (disposed) return
    void consume()
  }
  media.addEventListener('sourceopen', start, { once: true })

  return Object.freeze({ url, streaming: true as const, dispose })
}
