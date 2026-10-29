/**
 * A single shared microphone stream plus an analyser, so the reactor can pulse
 * with the user's voice. Opening the mic more than once causes Chrome to drop
 * the earlier stream, so everything that needs audio goes through here.
 */

import { createSharedMic } from './mic-lease'

// ASUS-only experiment. Chrome's AGC can raise distant speech as if it were
// close to the laptop. Keep noise suppression and echo cancellation enabled.
const NEAR_FIELD_FOCUS = import.meta.env.VITE_LUMIA_NEAR_FIELD_FOCUS === '1'
let observedAutoGain: boolean | null = null
export const microphoneAutoGainObserved = () => observedAutoGain

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let analyserStream: MediaStream | null = null
let buf: Uint8Array | null = null
let analyserOpening: Promise<void> | null = null

// The original getMic() returned a cached stream unconditionally and could
// run two concurrent getUserMedia prompts. Both are dangerous when a Windows
// headset is removed, reconnected, or the voice loop restarts during boot.
const sharedMic = createSharedMic(() =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: !NEAR_FIELD_FOCUS,
    },
  }),
)

export async function getMic(): Promise<MediaStream> {
  const stream = await sharedMic()
  const actual = stream.getAudioTracks()[0]?.getSettings?.().autoGainControl
  observedAutoGain = typeof actual === 'boolean' ? actual : null
  return stream
}

export function startAnalyser(): Promise<void> {
  if (analyserOpening) return analyserOpening
  const attempt: Promise<void> = (async () => {
    const sourceStream = await getMic()
    if (analyser && analyserStream === sourceStream && ctx?.state !== 'closed') return

    // Rebind the analyser to a newly acquired microphone instead of reading
    // a dead original stream forever after a USB/Bluetooth device changes.
    const oldContext = ctx
    ctx = null
    analyser = null
    analyserStream = null
    buf = null
    if (oldContext) await oldContext.close().catch(() => {})

    const freshContext = new AudioContext()
    try {
      const source = freshContext.createMediaStreamSource(sourceStream)
      const next = freshContext.createAnalyser()
      next.fftSize = 512
      next.smoothingTimeConstant = 0.75
      source.connect(next)
      ctx = freshContext
      analyser = next
      analyserStream = sourceStream
      buf = new Uint8Array(next.frequencyBinCount)
    } catch (error) {
      void freshContext.close().catch(() => {})
      throw error
    }
  })().finally(() => {
    if (analyserOpening === attempt) analyserOpening = null
  })
  analyserOpening = attempt
  return attempt
}

/** 0..1 loudness. Returns 0 before the analyser is up. */
export function micLevel(): number {
  if (!analyser || !buf) return 0
  analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>)
  let sum = 0
  // Skip the lowest bins — they're mostly rumble and mains hum.
  for (let i = 4; i < buf.length; i++) sum += buf[i]
  const avg = sum / (buf.length - 4) / 255
  // Voice sits low in this range; stretch it so the visuals actually move.
  return Math.min(1, avg * 3.2)
}

/** Analyser fed from an <audio> element, so the orb reacts while JARVIS talks. */
export function attachOutputAnalyser(el: HTMLAudioElement): () => number {
  const c = new AudioContext()
  const src = c.createMediaElementSource(el)
  const a = c.createAnalyser()
  a.fftSize = 512
  a.smoothingTimeConstant = 0.7
  src.connect(a)
  a.connect(c.destination)
  const b = new Uint8Array(a.frequencyBinCount)
  return () => {
    a.getByteFrequencyData(b as Uint8Array<ArrayBuffer>)
    let sum = 0
    for (let i = 2; i < b.length; i++) sum += b[i]
    return Math.min(1, sum / (b.length - 2) / 255 * 3)
  }
}
