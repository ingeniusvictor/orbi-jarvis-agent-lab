/**
 * Serializes access to one physical microphone stream across analyser, VAD
 * and optional voice diagnostics. A common Chrome/Windows fault is two
 * simultaneous getUserMedia calls replacing one another's audio device.
 *
 * The lease stores only a MediaStream reference in memory: no samples,
 * transcripts, screenshots or audio files are retained.
 */
export type SharedMicLease = (() => Promise<MediaStream>) & { release: () => void }

export function createSharedMic(open: () => Promise<MediaStream>): SharedMicLease {
  let current: MediaStream | null = null
  let opening: Promise<MediaStream> | null = null
  let generation = 0
  const release = () => {
    generation++
    if (current) for (const track of current.getTracks()) track.stop()
    current = null
    // A pending permission request is invalidated by generation checking.
    opening = null
  }

  const getSharedMic = (): Promise<MediaStream> => {
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

    const requestedAt = generation
    const attempt: Promise<MediaStream> = Promise.resolve()
      .then(open)
      .then((fresh) => {
        if (requestedAt !== generation) {
          for (const track of fresh.getTracks()) track.stop()
          throw new Error('Microphone request cancelled.')
        }
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
  return Object.assign(getSharedMic, { release })
}
