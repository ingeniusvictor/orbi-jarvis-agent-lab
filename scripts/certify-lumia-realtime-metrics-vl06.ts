import assert from 'node:assert/strict'
import {
  createRealtimeTurnMeter,
  summarizeRealtimeLatency,
} from '../src/lib/realtime-turn-metrics'

assert.deepEqual(summarizeRealtimeLatency([]), {
  count: 0, lastMs: null, medianMs: null, p95Ms: null, interrupted: 0,
})
assert.deepEqual(summarizeRealtimeLatency([150, 100, 300, 200], 2), {
  count: 4, lastMs: 200, medianMs: 150, p95Ms: 300, interrupted: 2,
})
assert.deepEqual(summarizeRealtimeLatency([2, -1, NaN, Infinity, 32000]), {
  count: 1, lastMs: 2, medianMs: 2, p95Ms: 2, interrupted: 0,
})

let clock = 1000
let latest = summarizeRealtimeLatency([])
const meter = createRealtimeTurnMeter((stats) => { latest = stats }, () => clock)
assert.equal(latest.count, 0)

// Events may arrive out of order, but no start can make a latency without
// a preceding server-VAD speech stop.
meter.onEvent('output_audio_buffer.started')
assert.equal(latest.count, 0)
meter.onEvent('input_audio_buffer.speech_stopped')
clock += 245
meter.onEvent('response.created')
clock += 40
meter.onEvent('output_audio_buffer.started')
assert.equal(latest.count, 1)
assert.equal(latest.lastMs, 285)
assert.equal(latest.medianMs, 285)

// A second speech start supersedes the pending end/response and prevents
// attributing the previous speaker's output to a new user turn.
meter.onEvent('input_audio_buffer.speech_stopped')
clock += 60
meter.onEvent('input_audio_buffer.speech_started')
meter.onEvent('output_audio_buffer.started')
assert.equal(latest.count, 1)
assert.equal(latest.interrupted, 1)

// Interrupted output must not invent a new sample.
meter.onEvent('input_audio_buffer.speech_stopped')
meter.onEvent('output_audio_buffer.cleared')
meter.onEvent('output_audio_buffer.started')
assert.equal(latest.count, 1)
assert.equal(latest.interrupted, 2)

meter.onEvent('input_audio_buffer.speech_stopped')
clock += 45000
meter.onEvent('output_audio_buffer.started')
assert.equal(latest.count, 1, 'Implausible latency is ignored.')
meter.clear()
assert.deepEqual(meter.snapshot(), {
  count: 0, lastMs: null, medianMs: null, p95Ms: null, interrupted: 0,
})

for (let i = 0; i < 34; i++) {
  meter.onEvent('input_audio_buffer.speech_stopped')
  clock += 200 + i
  meter.onEvent('output_audio_buffer.started')
}
assert.equal(latest.count, 30, 'Only the last 30 numeric samples remain.')
assert.ok(latest.p95Ms !== null && latest.p95Ms >= latest.medianMs!)
const serialized = JSON.stringify(latest)
assert.ok(!serialized.includes('audio'))
assert.ok(!serialized.includes('transcript'))
assert.ok(!serialized.includes('pin'))

console.log('LUMIA VL-06 privacy-safe Realtime latency meter: PASS')
console.log('VAD speech stopped -> server begins sending audio, NOT audible onset')
