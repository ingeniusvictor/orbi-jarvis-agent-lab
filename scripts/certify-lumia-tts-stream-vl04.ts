import assert from 'node:assert/strict'
import { createStreamingMp3, supportsStreamingMp3 } from '../src/lib/streaming-mp3'

type FakeMs = EventTarget & {
  readyState: string
  source: FakeBuffer | null
  addSourceBuffer: (mime: string) => FakeBuffer
  endOfStream: (error?: string) => void
  ended: boolean
}

class FakeBuffer extends EventTarget {
  updating = false
  chunks: number[] = []
  appendBuffer(bytes: Uint8Array) {
    if (this.updating) throw new Error('Concurrent append detected')
    this.updating = true
    this.chunks.push(bytes.byteLength)
    queueMicrotask(() => {
      this.updating = false
      this.dispatchEvent(new Event('updateend'))
    })
  }
  abort() {
    this.updating = false
    this.dispatchEvent(new Event('abort'))
  }
}

let typeSupported = true
let lastMedia: FakeMs | null = null
const urls: string[] = []
const revoked: string[] = []

class FakeMediaSource extends EventTarget {
  static isTypeSupported(mime: string) { return typeSupported && mime === 'audio/mpeg' }
  readyState = 'closed'
  source: FakeBuffer | null = null
  ended = false
  addSourceBuffer(mime: string) {
    assert.equal(mime, 'audio/mpeg')
    this.source = new FakeBuffer()
    return this.source
  }
  endOfStream() { this.ended = true; this.readyState = 'ended' }
}

const originalMs = Object.getOwnPropertyDescriptor(globalThis, 'MediaSource')
const createURL = URL.createObjectURL
const revokeURL = URL.revokeObjectURL
Object.defineProperty(globalThis, 'MediaSource', {
  configurable: true, value: FakeMediaSource,
})
URL.createObjectURL = (input: object) => {
  lastMedia = input as FakeMs
  const url = 'blob:fake-stream-' + String(urls.length + 1)
  urls.push(url)
  return url
}
URL.revokeObjectURL = (url: string) => { revoked.push(url) }

const response = (chunks: number[][], mime = 'audio/mpeg') =>
  new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of chunks) controller.enqueue(new Uint8Array(part))
      controller.close()
    },
  }), { status: 200, headers: { 'content-type': mime } })

const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((done) => setTimeout(done, 0))
}
const open = () => {
  assert.ok(lastMedia)
  const ms = lastMedia as FakeMs
  ms.readyState = 'open'
  ms.dispatchEvent(new Event('sourceopen'))
  return ms
}

try {
  assert.equal(supportsStreamingMp3(), true)
  typeSupported = false
  const fallback = response([[1, 2, 3]])
  assert.equal(createStreamingMp3(fallback), null)
  assert.equal(fallback.body?.locked, false, 'Unsupported MSE leaves the body for the legacy Blob path.')
  typeSupported = true

  assert.equal(createStreamingMp3(response([[1]], 'audio/wav')), null)
  assert.equal(createStreamingMp3(new Response(null, { status: 503 })), null)

  let chunks = 0
  let bytes = 0
  let failures = 0
  const out = createStreamingMp3(response([[0xff, 0xfb], [1, 2, 3, 4], [7]]), {
    onChunk: (size) => { chunks++; bytes += size },
    onFailure: () => failures++,
  })
  assert.ok(out && out.streaming)
  assert.equal(chunks, 0, 'Reading must start only after the HTML audio element attaches.')
  const ms = open()
  await settle()
  assert.equal(chunks, 3)
  assert.equal(bytes, 7)
  assert.deepEqual(ms.source?.chunks, [2, 4, 1])
  assert.equal(ms.ended, true)
  assert.equal(failures, 0)
  out.dispose()
  out.dispose()
  assert.equal(revoked.filter((u) => u === out.url).length, 1, 'Resource cleanup must be idempotent.')

  let cancelled = false
  const waiting = new Response(new ReadableStream<Uint8Array>({
    start() { /* A network stream still awaiting its first byte. */ },
    cancel() { cancelled = true },
  }), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  const future = createStreamingMp3(waiting)
  assert.ok(future)
  open()
  await settle()
  future.dispose()
  await settle()
  assert.equal(cancelled, true, 'Barge-in must cancel a pending network stream.')
  assert.ok(revoked.includes(future.url))

  const neverPlayed = new Response(new ReadableStream<Uint8Array>({
    start() {},
    cancel() { cancelled = true },
  }), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  const prefetched = createStreamingMp3(neverPlayed)
  assert.ok(prefetched)
  // Even when the audio element was never attached, prefetch must be disposable.
  prefetched.dispose()
  await settle()
  assert.ok(revoked.includes(prefetched.url))

  console.log('LUMIA VL-04 MSE MP3 transport contract: PASS')
  console.log('Fallback, sequential append, progressive chunks, stream completion and cancel: PASS')
  console.log('Actual Windows audio/latency test: NOT PERFORMED')
} finally {
  if (originalMs) Object.defineProperty(globalThis, 'MediaSource', originalMs)
  else Reflect.deleteProperty(globalThis, 'MediaSource')
  URL.createObjectURL = createURL
  URL.revokeObjectURL = revokeURL
}
