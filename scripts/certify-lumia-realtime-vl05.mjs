import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createRealtimeGrantService,
  realtimeReady,
  realtimeSessionConfig,
  validRealtimeOrigin,
  REALTIME_MAX_SESSIONS_PER_BOOT,
  REALTIME_TRIAL_SECONDS,
} from '../bridge/orbia/realtime-grants.mjs'

const ownerPin = 'local-only-strong-owner-pin-123'
const env = {
  ORBIA_REALTIME_EXPERIMENT: '1',
  OPENAI_API_KEY: 'test-key-not-real-123',
  ORBIA_REALTIME_OWNER_PIN: ownerPin,
}

for (const origin of [
  'http://localhost:5173', 'http://127.0.0.1:5174',
  'http://localhost:4173', 'http://[::1]:8787',
]) assert.equal(validRealtimeOrigin(origin), true, origin)

for (const origin of [
  undefined, '', 'https://localhost:5173', 'http://localhost:3000',
  'http://evil.example.com:5173', 'http://localhost.evil.com:5173',
  'http://localhost:5173.evil.com', 'http://localhost:5173@evil.com',
  'http://localhost:5173/?any=1', 'http://localhost:5173#fragment',
]) assert.equal(validRealtimeOrigin(origin), false, String(origin))

assert.equal(realtimeReady(env), true)
assert.equal(realtimeReady({ ...env, ORBIA_REALTIME_EXPERIMENT: '0' }), false)
assert.equal(realtimeReady({ ...env, OPENAI_API_KEY: '' }), false)
assert.equal(realtimeReady({ ...env, ORBIA_REALTIME_OWNER_PIN: 'short' }), false)
const config = realtimeSessionConfig()
assert.equal(config.session.type, 'realtime')
assert.equal(config.session.model, 'gpt-realtime')
assert.deepEqual(config.session.tools, [])
assert.equal(config.session.tool_choice, 'none')
assert.deepEqual(config.session.output_modalities, ['audio'])
assert.equal(config.session.audio.input.turn_detection.type, 'server_vad')
assert.equal(config.expires_after.seconds, 60)
assert.equal(REALTIME_MAX_SESSIONS_PER_BOOT, 2)
assert.equal(REALTIME_TRIAL_SECONDS, 90)

let sent = 0
let recorded
let clock = 10000
const fetchFn = async (url, options) => {
  sent++
  assert.equal(url, 'https://api.openai.com/v1/realtime/client_secrets')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers.Authorization, 'Bearer test-key-not-real-123')
  recorded = JSON.parse(options.body)
  return new Response(JSON.stringify({
    value: 'ek_opaque-test-only', expires_at: 1700000000,
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const broker = createRealtimeGrantService({
  env, fetchFn, now: () => clock,
})

const request = { origin: 'http://localhost:5173', pin: ownerPin }
assert.equal((await broker.grant({ ...request, pin: 'invalid' })).status, 403)
assert.equal((await broker.grant({ ...request, origin: undefined })).status, 403)
assert.equal((await broker.grant({ ...request, origin: 'http://bad.example:5173' })).status, 403)
assert.equal(sent, 0, 'Do not mint credentials for invalid owner/browser requests.')

const accepted = await broker.grant(request)
assert.equal(accepted.status, 200)
assert.equal(accepted.body.clientSecret, 'ek_opaque-test-only')
assert.equal(accepted.body.toolsEnabled, false)
assert.equal(accepted.body.maxTrialSeconds, 90)
assert.deepEqual(recorded.session.tools, [])
assert.equal(recorded.session.tool_choice, 'none')
assert.equal(broker.remaining(), 1)
assert.equal((await broker.grant(request)).status, 429, 'Cooldown holds after an accepted grant.')
clock += 4000
assert.equal((await broker.grant(request)).status, 200)
clock += 4000
assert.equal((await broker.grant(request)).status, 429, 'Only two trials per process boot.')
assert.equal(sent, 2)

let waiting
const pendingProvider = new Promise((resolve) => { waiting = resolve })
let concurrentCalls = 0
const overlapping = createRealtimeGrantService({
  env, now: () => 99999,
  fetchFn: () => {
    concurrentCalls++
    return pendingProvider
  },
})
const pending = overlapping.grant(request)
assert.equal((await overlapping.grant(request)).status, 429)
assert.equal(concurrentCalls, 1)
waiting(new Response(JSON.stringify({ value: 'ek_ok', expires_at: 1 }), { status: 200 }))
assert.equal((await pending).status, 200)

const absent = createRealtimeGrantService({
  env: { ...env, ORBIA_REALTIME_EXPERIMENT: '0' }, fetchFn,
})
assert.equal((await absent.grant(request)).status, 403)

const bridgeCode = readFileSync(new URL('../bridge/server.mjs', import.meta.url), 'utf8')
const clientCode = readFileSync(new URL('../src/lib/realtime-voice.ts', import.meta.url), 'utf8')
const appCode = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.match(bridgeCode, /realtimeGrants\.grant/)
assert.match(bridgeCode, /req\.headers\['x-orbia-realtime-pin'\]/)
assert.match(clientCode, /pc\.createDataChannel\('oai-events'\)/)
assert.match(clientCode, /\/v1\/realtime\/calls/)
assert.match(clientCode, /REALTIME_TRIAL_MAX_MS\s*=\s*90_000/)
assert.match(appCode, /voice\.current\?\.stop\(\)/)
assert.match(appCode, /onResumeNormal/)
assert.doesNotMatch(clientCode, /JARVIS_ALLOW_WRITES|MCP_SERVERS|canUseTool/)

console.log('LUMIA VL-05 local-owner WebRTC broker contract: PASS')
console.log('No credential without manual local authorization; no tool permissions: PASS')
console.log('Hard UI 90s and per-boot 2 tokens are NOT provider billing-account caps')
console.log('Windows microphone/WebRTC/live provider integration: NOT PERFORMED')
