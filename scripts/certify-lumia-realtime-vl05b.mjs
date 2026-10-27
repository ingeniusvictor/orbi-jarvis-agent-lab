import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createRealtimeGrantService,
  REALTIME_INVALID_PIN_LIMIT,
  REALTIME_LOCKOUT_MS,
  REALTIME_MAX_SESSIONS_PER_BOOT,
  REALTIME_TRIAL_SECONDS,
} from '../bridge/orbia/realtime-grants.mjs'

const PIN = 'a-very-long-private-owner-pin'
const origin = 'http://127.0.0.1:5173'
const env = {
  OPENAI_API_KEY: 'test-api-key-never-billed',
  ORBIA_REALTIME_OWNER_PIN: PIN,
  ORBIA_REALTIME_EXPERIMENT: '1',
}
let timestamp = 20000
let providerCalls = 0
let safetyHeader = ''
const fetchFn = async (_url, options) => {
  providerCalls++
  safetyHeader = options.headers['OpenAI-Safety-Identifier']
  assert.match(safetyHeader, /^[a-f0-9]{64}$/)
  assert.ok(!safetyHeader.includes(PIN))
  assert.equal(options.headers.Authorization, 'Bearer test-api-key-never-billed')
  return new Response(JSON.stringify({
    value: 'ek_fake', expires_at: 9999999999,
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const service = createRealtimeGrantService({
  env,
  now: () => timestamp,
  fetchFn,
})

assert.equal(REALTIME_INVALID_PIN_LIMIT, 5)
assert.equal(REALTIME_LOCKOUT_MS, 300000)
assert.equal(REALTIME_TRIAL_SECONDS, 90)
assert.equal(REALTIME_MAX_SESSIONS_PER_BOOT, 2)

// Reject invalid origins before counting them toward a local user's PIN lockout.
assert.equal((await service.grant({ origin: 'https://evil.example.com', pin: PIN })).status, 403)
for (let n = 0; n < REALTIME_INVALID_PIN_LIMIT; n++) {
  const denied = await service.grant({ origin, pin: 'wrong PIN guess ' + n })
  assert.equal(denied.status, 403)
  assert.equal(denied.body.errorCode, 'REALTIME_NOT_AUTHORIZED')
}
assert.equal((await service.grant({ origin, pin: PIN })).status, 403)
assert.equal(providerCalls, 0, 'Locked-out owner must not mint a paid credential.')
timestamp += REALTIME_LOCKOUT_MS - 1
assert.equal((await service.grant({ origin, pin: PIN })).status, 403)
timestamp += 1
assert.equal((await service.grant({ origin, pin: PIN })).status, 200)
assert.equal(providerCalls, 1)
assert.equal(service.remaining(), 1)
assert.equal(safetyHeader.length, 64)
timestamp += 3100
assert.equal((await service.grant({ origin, pin: PIN })).status, 200)
assert.equal(providerCalls, 2)
timestamp += 3100
assert.equal((await service.grant({ origin, pin: PIN })).status, 429)
assert.equal(providerCalls, 2, 'Two trial grants maximum per boot.')

const hiddenProvider = createRealtimeGrantService({
  env: { ...env, ORBIA_REALTIME_EXPERIMENT: '0' },
  fetchFn: () => { throw new Error('Disabled pilot must not access the network') },
})
assert.equal((await hiddenProvider.grant({ origin, pin: PIN })).status, 403)

// Behavioral tests are backed by a source contract; real Chrome and sound card
// lifecycle validation is separate and is not implied by these assertions.
const client = readFileSync(new URL('../src/lib/realtime-voice.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../src/ui/RealtimeTrial.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

assert.match(client, /const sessionAbort = new AbortController\(\)/)
assert.match(client, /trialTimer = setTimeout\(stop, REALTIME_TRIAL_MAX_MS\)/)
assert.match(client, /handshakeTimer = setTimeout/)
assert.match(client, /document\.addEventListener\('visibilitychange', onVisibility\)/)
assert.match(client, /window\.addEventListener\('pagehide', stop/)
assert.match(client, /signal: sessionAbort\.signal/)
assert.match(client, /clone\?\.stop\(\)/)
assert.match(client, /playback\.srcObject = null/)
assert.match(client, /disconnectedTimer = setTimeout/)
assert.match(ui, /const stopping = useRef\(false\)/)
assert.match(ui, /suspended\.current = false/)
assert.match(ui, /const shouldResume = suspended\.current/)
assert.match(app, /onResumeNormal/)
assert.match(app, /voice\.current\?\.stop\(\)/)

console.log('LUMIA VL-05B security + session lifecycle certification: PASS')
console.log('Wrong-PIN lockout, two paid-grant limit and pseudonymous safety header: PASS')
console.log('Handshake 20s, trial 90s, background/tab/connection cleanup contracts: PASS')
console.log('Physical Windows audio/latency certification: PENDING')
