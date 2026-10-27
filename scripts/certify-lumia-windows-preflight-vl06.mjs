import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inspectVoicePreflight } from './lumia-voice-preflight.mjs'
import { createRealtimeGrantService } from '../bridge/orbia/realtime-grants.mjs'

const safeEnv = {
  JARVIS_BRIDGE_PORT: '8787',
  JARVIS_ALLOW_WRITES: '0',
  ORBIA_REALTIME_EXPERIMENT: '0',
  VITE_LUMIA_REALTIME_EXPERIMENT: '0',
}
const offline = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '22.9.0',
  live: false, fetchFn: () => { throw new Error('Offline mode used network') },
})
assert.equal(offline.pass, true)
assert.equal(offline.bridge.checked, false)
assert.equal(offline.flags.backendRealtimeRequested, false)

let calls = []
const mockLive = async (url, opts) => {
  calls.push({ url, method: opts.method, headers: opts.headers })
  if (url.endsWith('/health')) {
    return new Response(JSON.stringify({
      ok: true,
      voice: { effective: { effectiveStt: 'local', effectiveTts: 'local' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  assert.ok(url.endsWith('/voice/realtime/client-secret'))
  assert.equal(opts.method, 'POST')
  assert.equal(opts.headers['x-orbia-realtime-pin'], undefined)
  return new Response('{}', { status: 403 })
}
const online = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '22.9.0',
  live: true, fetchFn: mockLive,
})
assert.equal(online.pass, true)
assert.equal(online.bridge.reachable, true)
assert.equal(online.bridge.guardedRealtimeEndpoint, true)
assert.equal(online.bridge.stt, 'local')
assert.equal(online.bridge.tts, 'local')
assert.equal(calls.length, 3)
assert.equal(calls.filter(v => v.method === 'POST').length, 2)

assert.deepEqual(calls.filter(v => v.method === 'POST').map(v => v.headers.Origin ?? null),
  [null, 'http://realtime-preflight.invalid'],
  'Preflight must NEVER send a wrong PIN from an allowed local origin.')

// Regression: a technician can run the local preflight repeatedly without
// consuming five failed-PIN attempts and accidentally locking out the owner.
// The broker is REAL; only its upstream paid provider is simulated.
let providerCalls = 0
const PIN = 'long-local-pin-for-regression-only'
const realBroker = createRealtimeGrantService({
  env: {
    ORBIA_REALTIME_EXPERIMENT: '1',
    OPENAI_API_KEY: 'dummy-do-not-bill-test-key',
    ORBIA_REALTIME_OWNER_PIN: PIN,
  },
  now: () => 45000,
  fetchFn: async () => {
    providerCalls++
    return new Response(JSON.stringify({ value: 'ek_ci-fake', expires_at: 999999 }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  },
})
const brokerBridge = async (url, opts) => {
  if (url.endsWith('/health')) {
    return new Response(JSON.stringify({
      ok: true,
      voice: { effective: { effectiveStt: 'local', effectiveTts: 'local' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await realBroker.grant({
    origin: opts.headers.Origin,
    pin: opts.headers['x-orbia-realtime-pin'],
    bridgePort: 8787,
  })
  return new Response(JSON.stringify(result.body), { status: result.status })
}
for (let i = 0; i < 8; i++) {
  const check = await inspectVoicePreflight({
    env: safeEnv, platform: 'win32', nodeVersion: '22.9.0',
    live: true, fetchFn: brokerBridge,
  })
  assert.equal(check.pass, true, 'Repeated safe preflight must remain valid.')
}
assert.equal(providerCalls, 0, 'Preflight must not mint any billable secret.')
assert.equal(realBroker.remaining(), 2, 'Preflight must not use a pilot credential.')
const ownerTrial = await realBroker.grant({ origin: 'http://localhost:5173', pin: PIN })
assert.equal(ownerTrial.status, 200, 'Owner must not be locked out by repeated preflight.')
assert.equal(providerCalls, 1)


const oldNode = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '18.0.0', live: false,
})
assert.equal(oldNode.pass, false)

const writes = await inspectVoicePreflight({
  env: { ...safeEnv, JARVIS_ALLOW_WRITES: '1' },
  platform: 'win32', nodeVersion: '22.9.0', live: false,
})
assert.equal(writes.pass, false)

const missingBridge = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '22.9.0',
  live: true, fetchFn: () => { throw new Error('connection refused') },
})
assert.equal(missingBridge.pass, false)
assert.equal(missingBridge.bridge.reachable, false)

const fakeBridge = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '22.9.0', live: true,
  fetchFn: () => new Response(JSON.stringify({ ok: true, voice: null }), { status: 200 }),
})
assert.equal(fakeBridge.pass, false)
assert.equal(fakeBridge.bridge.guardedRealtimeEndpoint, null)

const unguardedBridge = await inspectVoicePreflight({
  env: safeEnv, platform: 'win32', nodeVersion: '22.9.0', live: true,
  fetchFn: (url) => url.endsWith('/health')
    ? new Response(JSON.stringify({ ok: true, voice: {} }), { status: 200 })
    : new Response('{}', { status: 200 }),
})
assert.equal(unguardedBridge.pass, false)
assert.equal(unguardedBridge.bridge.guardedRealtimeEndpoint, false)

const secretValue = 'VERY-PRIVATE-OWNER-SECRET'
const withSecrets = await inspectVoicePreflight({
  env: {
    ...safeEnv,
    OPENAI_API_KEY: 'API-PRIVATE-SECRET-XYZ',
    ORBIA_REALTIME_OWNER_PIN: secretValue,
    ORBIA_REALTIME_EXPERIMENT: '1',
    VITE_LUMIA_REALTIME_EXPERIMENT: '1',
  },
  platform: 'win32', nodeVersion: '22.9.0', live: false,
})
const printable = JSON.stringify(withSecrets)
assert.ok(!printable.includes(secretValue))
assert.ok(!printable.includes('API-PRIVATE-SECRET-XYZ'))
assert.equal(withSecrets.flags.ownerPinConfigured, true)
assert.equal(withSecrets.flags.apiKeyConfigured, true)

// The Windows launcher must remain a transient, read-only LOCAL check.
// It must not enable the paid Realtime path or inherit a cloud brain choice.
const launcher = readFileSync(
  new URL('../PROBAR_VOZ_LOCAL_LUMIA_WINDOWS.cmd', import.meta.url), 'utf8',
)
for (const flag of [
  'set "VITE_BACKEND=bridge"',
  'set "ORBIA_BRAIN_PROVIDER=ollama"',
  'set "JARVIS_ALLOW_WRITES=0"',
  'set "ORBIA_REALTIME_EXPERIMENT=0"',
  'set "VITE_LUMIA_REALTIME_EXPERIMENT=0"',
  'set "VITE_USE_ELEVENLABS=0"',
  'set "ORBIA_LUMIA_STT_MODE=local"',
  'set "ORBIA_LUMIA_TTS_MODE=local"',
  'set "VITE_LUMIA_ACOUSTIC_LAB=1"',
  'call npm run start:lumia',
]) {
  assert.ok(launcher.includes(flag), 'Windows launcher must include: ' + flag)
}
assert.doesNotMatch(launcher, /git\s+(checkout|reset|merge|push|switch)\b/i)
assert.doesNotMatch(launcher, /^(?!\s*rem\b|\s*echo\b).*?\b(?:call\s+)?npm\s+ci\b/im) // documented, never run.
assert.doesNotMatch(launcher, /set\s+"?OPENAI_API_KEY=/i)
assert.doesNotMatch(launcher, /set\s+"?ORBIA_REALTIME_OWNER_PIN=/i)

console.log('LUMIA VL-06 Windows/offline preflight contract: PASS')
console.log('No paid token requests or secrets printed; unauthorized probes must deny: PASS')
console.log('True Windows hardware voice certification: NOT PERFORMED')
