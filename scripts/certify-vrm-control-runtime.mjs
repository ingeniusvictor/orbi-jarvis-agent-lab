import assert from 'node:assert/strict'
import { applyVoiceRuntimeControl } from '../bridge/orbia/voice-control.mjs'
import { parseVoiceRuntimeControl } from '../bridge/orbia/voice-runtime.mjs'

let result = applyVoiceRuntimeControl(
  parseVoiceRuntimeControl('Lumi, ¿qué modo de voz estás usando?'),
)
assert.equal(result.changed, false)
assert.equal(result.status.status, 'READY')
assert.match(result.answer, /Reconocimiento/i)

result = applyVoiceRuntimeControl(
  parseVoiceRuntimeControl('Lumi, ¿qué voces tienes?'),
)
assert.equal(result.changed, false)
assert.match(result.answer, /perfiles de voz/i)

result = applyVoiceRuntimeControl(
  parseVoiceRuntimeControl('Lumi, usa modo navegador'),
)
assert.equal(result.changed, true)
assert.equal(result.status.requested.sttMode, 'browser')
assert.equal(result.status.requested.ttsMode, 'system')
assert.equal(result.status.requested.voiceProfile, 'lumia-system')
assert.equal(result.status.effective.effectiveStt, 'browser')
assert.equal(result.status.effective.effectiveTts, 'system')

result = applyVoiceRuntimeControl(
  parseVoiceRuntimeControl('Lumi, activa modo local'),
)
assert.equal(result.changed, true)
assert.equal(result.status.requested.sttMode, 'local')
assert.equal(result.status.requested.ttsMode, 'local')
assert.ok(['local', 'browser', 'unavailable'].includes(result.status.effective.effectiveStt))
assert.ok(['local', 'system', 'unavailable'].includes(result.status.effective.effectiveTts))

result = applyVoiceRuntimeControl(
  parseVoiceRuntimeControl('Lumi, activa modo de voz automático'),
)
assert.equal(result.changed, true)
assert.equal(result.status.requested.sttMode, 'auto')
assert.equal(result.status.requested.ttsMode, 'auto')

console.log('VRM-01B runtime control smoke test: PASS')
console.log('Status/list: deterministic')
console.log('Browser/local/auto modes: runtime state changes without LLM ownership')
console.log('Local readiness: fallback-aware')
