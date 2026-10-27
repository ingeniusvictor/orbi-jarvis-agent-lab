/**
 * L.U.M.I.A. VL-05 — owner-authorized, local-only ephemeral Realtime credentials.
 *
 * No cloud session can be created without an explicit Node-side enable flag,
 * a separate owner PIN and a locally hosted UI Origin. This is intentionally
 * independent from the regular brain/tool runtime: the Realtime session has
 * zero tools and cannot authorize shell/browser/write operations.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

export const REALTIME_MODEL = 'gpt-realtime'
export const REALTIME_VOICE = 'marin'
export const REALTIME_MAX_SESSIONS_PER_BOOT = 2
export const REALTIME_TRIAL_SECONDS = 90

const approvedHostname = new Set(['localhost', '127.0.0.1', '[::1]'])

export function validRealtimeOrigin(origin, bridgePort = 8787) {
  if (typeof origin !== 'string' || !origin) return false
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) return false
    if (!approvedHostname.has(url.hostname)) return false
    const port = Number(url.port)
    return port === Number(bridgePort) ||
      (port >= 5173 && port <= 5199) ||
      (port >= 4173 && port <= 4199)
  } catch {
    return false
  }
}

function samePin(provided, required) {
  if (typeof provided !== 'string' || typeof required !== 'string') return false
  if (required.length < 12 || provided.length > 256 || !provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(required).digest()
  return timingSafeEqual(a, b)
}

export function realtimeReady(env = process.env) {
  return env.ORBIA_REALTIME_EXPERIMENT === '1' &&
    typeof env.OPENAI_API_KEY === 'string' &&
    env.OPENAI_API_KEY.trim().length >= 12 &&
    typeof env.ORBIA_REALTIME_OWNER_PIN === 'string' &&
    env.ORBIA_REALTIME_OWNER_PIN.length >= 12
}

export function realtimeSessionConfig() {
  return {
    expires_after: { anchor: 'created_at', seconds: 60 },
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      instructions:
        'Eres L.U.M.I.A., compañera conversacional de ORBI. Responde en español ' +
        'latinoamericano con calidez y naturalidad, de forma clara y breve. ' +
        'En este modo experimental SOLO puedes conversar. No tienes acceso ' +
        'a herramientas, archivos, automatizaciones, identidad biométrica, ' +
        'cuentas, dispositivos ni permisos para ejecutar acciones. No afirmes ' +
        'haber realizado tareas. Si piden una acción, explica que deben ' +
        'regresar al modo normal de LUMIA para que sus permisos se revisen.',
      output_modalities: ['audio'],
      max_output_tokens: 320,
      tools: [],
      tool_choice: 'none',
      audio: {
        output: { voice: REALTIME_VOICE },
        input: {
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
        },
      },
    },
  }
}

/** Per-process, fail-closed pilot budget, not a billing-account cap. */
export function createRealtimeGrantService({
  env = process.env,
  fetchFn = fetch,
  now = () => Date.now(),
} = {}) {
  let granted = 0
  let busy = false
  let lastAttempt = 0

  return {
    remaining: () => Math.max(0, REALTIME_MAX_SESSIONS_PER_BOOT - granted),
    async grant({ origin, pin, bridgePort = 8787 } = {}) {
      // Generic errors prevent exposing whether the owner PIN was correct.
      if (!validRealtimeOrigin(origin, bridgePort) || !realtimeReady(env) ||
          !samePin(pin, env.ORBIA_REALTIME_OWNER_PIN)) {
        return { status: 403, body: { ok: false, errorCode: 'REALTIME_NOT_AUTHORIZED' } }
      }
      if (busy || granted >= REALTIME_MAX_SESSIONS_PER_BOOT ||
          now() - lastAttempt < 3000) {
        return { status: 429, body: { ok: false, errorCode: 'REALTIME_PILOT_LIMIT' } }
      }
      // Reserve a trial before requesting an ephemeral token; never reissue
      // unbounded credentials after repeated upstream failures.
      busy = true
      granted++
      lastAttempt = now()
      try {
        const response = await fetchFn('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + env.OPENAI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(realtimeSessionConfig()),
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) {
          return { status: 502, body: { ok: false, errorCode: 'REALTIME_PROVIDER_UNAVAILABLE' } }
        }
        const data = await response.json()
        if (typeof data?.value !== 'string' || !data.value.startsWith('ek_')) {
          return { status: 502, body: { ok: false, errorCode: 'REALTIME_INVALID_GRANT' } }
        }
        return {
          status: 200,
          body: {
            ok: true,
            clientSecret: data.value,
            expiresAt: Number(data.expires_at) || null,
            maxTrialSeconds: REALTIME_TRIAL_SECONDS,
            model: REALTIME_MODEL,
            toolsEnabled: false,
          },
        }
      } catch {
        return { status: 502, body: { ok: false, errorCode: 'REALTIME_PROVIDER_UNAVAILABLE' } }
      } finally {
        busy = false
      }
    },
  }
}
