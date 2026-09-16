import assert from 'node:assert/strict'
import {
  createVoiceProfile,
  getVoiceProfile,
  getVoiceRuntimeState,
  listVoiceProfiles,
  parseVoiceRuntimeControl,
  registerVoiceProfile,
  resolveVoiceRuntime,
  setSttMode,
  setTtsMode,
  setVoiceProfile,
} from '../bridge/orbia/voice-runtime.mjs'

const before = getVoiceRuntimeState()

assert.ok(getVoiceProfile('lumia-system'))
assert.ok(getVoiceProfile('lumia-kokoro'))
assert.equal(getVoiceProfile('lumia-kokoro')?.enabled, false)

setSttMode('local')
setTtsMode('system')
assert.equal(getVoiceRuntimeState().sttMode, 'local')
assert.equal(getVoiceRuntimeState().ttsMode, 'system')

let resolved = resolveVoiceRuntime({
  localSttAvailable: true,
  browserSttAvailable: true,
  localTtsAvailable: false,
  systemTtsAvailable: true,
})
assert.equal(resolved.effectiveStt, 'local')
assert.equal(resolved.effectiveTts, 'system')

resolved = resolveVoiceRuntime({
  localSttAvailable: false,
  browserSttAvailable: true,
  localTtsAvailable: false,
  systemTtsAvailable: true,
})
assert.equal(resolved.effectiveStt, 'browser')

const custom = createVoiceProfile({
  id: 'cert-custom-voice',
  displayName: 'Certification custom voice',
  provider: 'custom-local',
  owner: 'certification',
  consentConfirmed: true,
  enabled: true,
})
registerVoiceProfile(custom)
assert.equal(getVoiceProfile('cert-custom-voice')?.provider, 'custom-local')
setVoiceProfile('cert-custom-voice')
assert.equal(getVoiceRuntimeState().voiceProfile, 'cert-custom-voice')

registerVoiceProfile({
  id: 'cert-no-consent',
  displayName: 'No consent test',
  provider: 'custom-local',
  owner: 'certification',
  consentConfirmed: false,
  enabled: true,
})
assert.throws(() => setVoiceProfile('cert-no-consent'), /consent/i)

assert.ok(listVoiceProfiles().length >= 4)

assert.deepEqual(
  parseVoiceRuntimeControl('Lumi, usa reconocimiento local'),
  { action: 'set_stt', mode: 'local' },
)
assert.deepEqual(
  parseVoiceRuntimeControl('Lumi, vuelve al reconocimiento del navegador'),
  { action: 'set_stt', mode: 'browser' },
)
assert.deepEqual(
  parseVoiceRuntimeControl('Lumi, usa la voz local'),
  { action: 'set_tts', mode: 'local' },
)
assert.deepEqual(
  parseVoiceRuntimeControl('Lumi, usa la voz del sistema'),
  { action: 'set_tts', mode: 'system' },
)
assert.deepEqual(
  parseVoiceRuntimeControl('Lumi, activa modo de voz automático'),
  { action: 'set_auto' },
)

setSttMode(before.sttMode)
setTtsMode(before.ttsMode)
setVoiceProfile(before.voiceProfile)

console.log('VRM-01A Voice Runtime Manager smoke test: PASS')
console.log('STT modes: auto / browser / local')
console.log('TTS modes: auto / system / local')
console.log('Voice profiles: provider-neutral registry + consent gate')
console.log('Fallback resolution: deterministic')
