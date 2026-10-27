/**
 * Serializes access to one physical microphone stream across analyser, VAD
 * and optional voice diagnostics. A common Chrome/Windows fault is two
 * simultaneous getUserMedia calls replacing one another's audio device.
 *
 * The lease stores only a MediaStream reference in memory: no samples,
 * transcripts, screenshots or audio files are retained.
 */
export function createSharedMic(open: () => Promise<MediaStream>): () => Promise<MediaStream> {
  let current: MediaStream | null = null
  let opening: Promise<MediaStream> | null = null

  return function getSharedMic(): Promise<MediaStream> {
    if (current?.getAudioTracks().some((track) => track.readyState === 'live')) {
      return Promise.resolve(current)
    }
    if (opening) return opening

    // The underlying device may have ended after a headset unplug/replug.
    // Invalidate the dead stream rather than handing it back forever.
    if (current) {
      for (const track of current.getTracks()) track.stop()
      current = null
    }

    const attempt = Promise.resolve()
      .then(open)
      .then((fresh) => {
        if (!fresh.getAudioTracks().some((track) => track.readyState === 'live')) {
          for (const track of fresh.getTracks()) track.stop()
          throw new Error('No hay un micrófono de audio activo.')
        }
        current = fresh
        return fresh
      })
      .finally(() => {
        if (opening === attempt) opening = null
      })
    opening = attempt
    return attempt
  }
}
