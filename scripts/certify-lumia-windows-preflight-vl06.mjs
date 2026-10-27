import assert from 'node:assert/strict'
import { inspectVoicePreflight } from './lumia-voice-preflight.mjs'

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

console.log('LUMIA VL-06 Windows/offline preflight contract: PASS')
console.log('No paid token requests or secrets printed; unauthorized probes must deny: PASS')
console.log('True Windows hardware voice certification: NOT PERFORMED')
