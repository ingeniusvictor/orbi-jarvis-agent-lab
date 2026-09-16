/**
 * Decode a browser MediaRecorder blob and re-encode it as mono PCM16 WAV.
 *
 * Whisper.cpp's simple CLI path is intentionally fed one deterministic format:
 * 16 kHz, one channel, signed 16-bit PCM. Conversion happens in the browser so
 * the bridge does not need ffmpeg or another codec process.
 */

let decodeContext: AudioContext | null = null

function context(): AudioContext {
  if (!decodeContext) decodeContext = new AudioContext()
  return decodeContext
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

export async function audioBlobToPcmWav(
  blob: Blob,
  targetRate = 16_000,
): Promise<Blob> {
  if (!blob.size) throw new Error('Audio segment is empty.')

  const encoded = await blob.arrayBuffer()
  const decoded = await context().decodeAudioData(encoded.slice(0))
  if (!decoded.length || !decoded.numberOfChannels) {
    throw new Error('Audio segment could not be decoded.')
  }

  const rate = Math.max(8_000, Math.min(48_000, Math.round(targetRate)))
  const outputLength = Math.max(1, Math.round(decoded.duration * rate))
  const output = new Float32Array(outputLength)
  const channels = Array.from(
    { length: decoded.numberOfChannels },
    (_, channel) => decoded.getChannelData(channel),
  )
  const ratio = decoded.sampleRate / rate

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio
    const left = Math.min(decoded.length - 1, Math.floor(position))
    const right = Math.min(decoded.length - 1, left + 1)
    const mix = position - left
    let sample = 0

    for (const channel of channels) {
      sample += channel[left] + (channel[right] - channel[left]) * mix
    }

    output[i] = sample / channels.length
  }

  const buffer = new ArrayBuffer(44 + outputLength * 2)
  const view = new DataView(buffer)
  const byteRate = rate * 2

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + outputLength * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, outputLength * 2, true)

  let offset = 44
  for (let i = 0; i < output.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, output[i]))
    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
