/**
 * VL-06: Safe Windows voice preflight. Does not request credentials, record
 * audio, enable experimental switches, call paid providers or print secrets.
 *
 * Usage:
 *   node scripts/lumia-voice-preflight.mjs
 *   node scripts/lumia-voice-preflight.mjs --live
 *   node scripts/lumia-voice-preflight.mjs --json --live
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

function bridgePort(env) {
  const n = Number(env.JARVIS_BRIDGE_PORT ?? '8787')
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : 8787
}

export async function inspectVoicePreflight({
  env = process.env,
  platform = process.platform,
  nodeVersion = process.versions.node,
  fetchFn = fetch,
  live = false,
} = {}) {
  const nodeMajor = Number(String(nodeVersion).split('.')[0])
  const report = {
    schema: 'LUMIA-VL06-PREFLIGHT-v1',
    platform,
    nodeVersion: String(nodeVersion),
    nodeSupported: Number.isInteger(nodeMajor) && nodeMajor >= 22,
    // Boolean diagnostics only; NO raw values from environment variables.
    flags: {
      frontendRealtimeRequested: env.VITE_LUMIA_REALTIME_EXPERIMENT === '1',
      backendRealtimeRequested: env.ORBIA_REALTIME_EXPERIMENT === '1',
      ownerPinConfigured: typeof env.ORBIA_REALTIME_OWNER_PIN === 'string' &&
        env.ORBIA_REALTIME_OWNER_PIN.length >= 12,
      apiKeyConfigured: typeof env.OPENAI_API_KEY === 'string' &&
        env.OPENAI_API_KEY.trim().length >= 12,
      writesAllowed: env.JARVIS_ALLOW_WRITES === '1',
    },
    bridge: {
      checked: Boolean(live),
      reachable: null,
      guardedRealtimeEndpoint: null,
      stt: 'unknown',
      tts: 'unknown',
    },
    warnings: [],
  }

  if (platform !== 'win32') {
    report.warnings.push('This run is not Windows; no Windows hardware claim is possible.')
  }
  if (!report.nodeSupported) {
    report.warnings.push('Node.js 22 or newer is recommended for VL-06 certification.')
  }
  if (report.flags.writesAllowed) {
    report.warnings.push('JARVIS_ALLOW_WRITES is ON. Use a read-only profile for voice testing.')
  }
  if (report.flags.frontendRealtimeRequested !== report.flags.backendRealtimeRequested) {
    report.warnings.push('Frontend and bridge Realtime flags differ in this process environment.')
  }
  if (report.flags.frontendRealtimeRequested || report.flags.backendRealtimeRequested) {
    report.warnings.push('Realtime cloud API usage may be billable. Check your provider budget.')
  }
  if (!live) {
    report.warnings.push('Offline preflight only. Start LUMIA, then rerun with --live.')
  } else {
    const url = 'http://127.0.0.1:' + bridgePort(env)
    try {
      const status = await fetchFn(url + '/health', {
        method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(2500),
      })
      const payload = status.ok ? await status.json() : null
      const expectedBridge = Boolean(
        payload?.ok && payload?.voice && typeof payload.voice === 'object',
      )
      report.bridge.reachable = expectedBridge
      if (expectedBridge) {
        report.bridge.stt = String(payload.voice.effective?.effectiveStt ?? 'unknown')
        report.bridge.tts = String(payload.voice.effective?.effectiveTts ?? 'unknown')
        // These requests carry NO owner PIN and NO valid authorization.
        // Realtime must fail closed BEFORE contacting the paid provider.
        const noOrigin = await fetchFn(url + '/voice/realtime/client-secret', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: '{}', cache: 'no-store', signal: AbortSignal.timeout(2500),
        })
        const wrongPin = await fetchFn(url + '/voice/realtime/client-secret', {
          method: 'POST',
          headers: {
            Origin: 'http://localhost:5173',
            'content-type': 'application/json',
          },
          body: '{}', cache: 'no-store', signal: AbortSignal.timeout(2500),
        })
        report.bridge.guardedRealtimeEndpoint =
          noOrigin.status === 403 && wrongPin.status === 403
        if (!report.bridge.guardedRealtimeEndpoint) {
          report.warnings.push('Realtime endpoint did not reject both unauthorized probes.')
        }
      } else {
        report.warnings.push('Local service response is not the expected LUMIA bridge.')
      }
    } catch {
      report.bridge.reachable = false
      report.warnings.push('LUMIA bridge unavailable on local loopback; start it first.')
    }
  }

  return {
    ...report,
    pass: report.nodeSupported && !report.flags.writesAllowed &&
      (!live || (report.bridge.reachable === true &&
        report.bridge.guardedRealtimeEndpoint === true)),
  }
}

function printReport(r) {
  console.log('LUMIA VL-06 · WINDOWS VOICE PREFLIGHT')
  console.log('------------------------------------')
  console.log('Host: ' + r.platform + ' · Node: ' + r.nodeVersion)
  console.log('Node 22+: ' + (r.nodeSupported ? 'OK' : 'UPDATE REQUIRED'))
  console.log('Normal actions read-only: ' + (!r.flags.writesAllowed ? 'OK' : 'DISABLE WRITES'))
  console.log('Realtime frontend requested: ' + (r.flags.frontendRealtimeRequested ? 'YES' : 'NO'))
  console.log('Realtime server requested: ' + (r.flags.backendRealtimeRequested ? 'YES' : 'NO'))
  console.log('Owner PIN configured: ' + (r.flags.ownerPinConfigured ? 'YES' : 'NO'))
  console.log('OpenAI API key configured: ' + (r.flags.apiKeyConfigured ? 'YES' : 'NO'))
  if (r.bridge.checked) {
    console.log('Local bridge: ' + (r.bridge.reachable ? 'REACHABLE' : 'UNAVAILABLE'))
    console.log('STT: ' + r.bridge.stt + ' · TTS: ' + r.bridge.tts)
    console.log('Unauthorized Realtime requests denied: ' +
      (r.bridge.guardedRealtimeEndpoint === true ? 'YES' : 'UNVERIFIED'))
  }
  for (const warning of r.warnings) console.log('NOTE: ' + warning)
  console.log(r.pass ? 'PREFLIGHT PASS (hardware sound NOT certified)' : 'PREFLIGHT REQUIRES ACTION')
}

const entry = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (entry) {
  const live = process.argv.includes('--live')
  const report = await inspectVoicePreflight({ live })
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else printReport(report)
  if (!report.pass) process.exitCode = 1
}
