import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSharedMic } from '../src/lib/mic-lease'

type FakeTrack = {
  readyState: 'live' | 'ended'
  stopped: boolean
  stop: () => void
}
type FakeMic = {
  getAudioTracks: () => FakeTrack[]
  getTracks: () => FakeTrack[]
}
const fakeTrack = (): FakeTrack => {
  const t: FakeTrack = {
    readyState: 'live',
    stopped: false,
    stop() {
      t.stopped = true
      t.readyState = 'ended'
    },
  }
  return t
}
const fakeMic = (): FakeMic => {
  const track = fakeTrack()
  return { getAudioTracks: () => [track], getTracks: () => [track] }
}

let resolveOpen: ((s: MediaStream) => void) | null = null
let attempts = 0
const lease = createSharedMic(() => {
  attempts++
  return new Promise<MediaStream>((resolve) => { resolveOpen = resolve })
})

const p1 = lease()
const p2 = lease()
assert.equal(p1, p2, 'Two simultaneous consumers must share the same acquisition promise.')
assert.equal(attempts, 0, 'Mic permission is requested asynchronously once.')
await Promise.resolve()
assert.equal(attempts, 1)
const first = fakeMic()
assert.ok(resolveOpen)
resolveOpen!(first as unknown as MediaStream)
assert.equal(await p1, first)
assert.equal(await p2, first)
assert.equal(await lease(), first, 'Healthy live mic must be reused.')
assert.equal(attempts, 1)

first.getAudioTracks()[0].readyState = 'ended'
const reconnect = lease()
await Promise.resolve()
assert.equal(attempts, 2)
assert.equal(first.getAudioTracks()[0].stopped, true, 'Stale device must be stopped.')
const second = fakeMic()
resolveOpen!(second as unknown as MediaStream)
assert.equal(await reconnect, second)
assert.notEqual(second, first)

const invalid = fakeMic()
invalid.getAudioTracks()[0].readyState = 'ended'
const invalidLease = createSharedMic(async () => invalid as unknown as MediaStream)
await assert.rejects(() => invalidLease(), /micrófono de audio activo/)
assert.equal(invalid.getAudioTracks()[0].stopped, true)

let failures = 0
const retryLease = createSharedMic(async () => {
  failures++
  if (failures === 1) throw new Error('Windows device is temporarily unavailable')
  return fakeMic() as unknown as MediaStream
})
await assert.rejects(() => retryLease(), /Windows device is temporarily unavailable/)
await retryLease()
assert.equal(failures, 2, 'A refused mic permission must not poison later retries.')

// No extra AudioContext is opened while the shared analyser is already being
// configured. Read-only source assertions guard this integration contract.
const audioCode = readFileSync(new URL('../src/lib/audio.ts', import.meta.url), 'utf8')
assert.match(audioCode, /const sharedMic = createSharedMic/)
assert.match(audioCode, /let analyserOpening: Promise<void> \| null = null/)
assert.match(audioCode, /if \(analyserOpening\) return analyserOpening/)
assert.match(audioCode, /analyserStream === sourceStream/)
assert.match(audioCode, /oldContext\.close\(\)/)
assert.doesNotMatch(audioCode, /if \(stream\) return stream/)

console.log('LUMIA VL-06 microphone lease and Windows reconnect contracts: PASS')
console.log('Duplicate mic prevention, dead-track refresh, rejection/retry and analyser rebinding: PASS')
console.log('Real Windows microphone/headset hardware: NOT TESTED')
