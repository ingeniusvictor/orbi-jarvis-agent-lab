import assert from 'node:assert/strict'
import {
  DEFAULT_FOLLOWUP_GUARD_MS,
  LOCAL_FOLLOWUP_MIN_MS,
  resolveFollowupGuardMs,
} from '../src/lib/followup-latency'

assert.equal(DEFAULT_FOLLOWUP_GUARD_MS, 2600)
assert.equal(LOCAL_FOLLOWUP_MIN_MS, 2050)

for (const engine of ['browser', 'elevenlabs', 'unknown', 'whisper-local', '']) {
  assert.equal(
    resolveFollowupGuardMs({ engine }),
    2600,
    'Fast follow-up must be opt-in and must not affect defaults.',
  )
}

for (const engine of ['browser', 'elevenlabs', 'unknown', '']) {
  assert.equal(
    resolveFollowupGuardMs({ engine, fastLocalFollowup: true }),
    2600,
    'Browser and cloud recognition must keep existing protection.',
  )
}

assert.equal(
  resolveFollowupGuardMs({ engine: 'whisper-local', fastLocalFollowup: true, echoTailMs: 1800 }),
  2050,
  'Local opt-in retains a 250 ms margin over the known TTS echo tail.',
)
assert.equal(
  resolveFollowupGuardMs({ engine: 'whisper-local', fastLocalFollowup: true, echoTailMs: 2650 }),
  2900,
  'Longer measured echo tail must increase rather than weaken the guard.',
)
assert.equal(
  resolveFollowupGuardMs({ engine: 'whisper-local', fastLocalFollowup: true, echoTailMs: -1 }),
  2600,
)
assert.equal(
  resolveFollowupGuardMs({ engine: 'whisper-local', fastLocalFollowup: true, echoTailMs: Number.NaN }),
  2600,
)
assert.equal(
  resolveFollowupGuardMs({ engine: 'whisper-local', fastLocalFollowup: true, echoTailMs: Number.POSITIVE_INFINITY }),
  2600,
)

console.log('LUMIA VL-02 guarded low-latency follow-up policy: PASS')
console.log('Browser/cloud defaults unchanged; local optimization opt-in; echo margin enforced')
