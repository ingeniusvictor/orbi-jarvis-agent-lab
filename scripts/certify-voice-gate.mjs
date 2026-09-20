import assert from 'node:assert/strict'
import {
  buildVoiceGateStatus,
  classifyVoiceGateEvidence,
  voiceGateConfig,
} from '../bridge/orbia/voice-gate.mjs'

const config = voiceGateConfig({})
assert.equal(config.mode, 'monitor')
assert.equal(config.liveThreshold, 0.75)
assert.equal(config.replayBlockThreshold, 0.65)

const background = classifyVoiceGateEvidence({
  wakeMatched: false,
  sessionOpen: false,
})
assert.equal(background.state, 'background')
assert.equal(background.monitorOnly, true)

const echo = classifyVoiceGateEvidence({
  wakeMatched: true,
  selfEcho: true,
})
assert.equal(echo.state, 'background')
assert.ok(echo.reasons.includes('assistant-self-echo'))

const uncertain = classifyVoiceGateEvidence({
  wakeMatched: true,
  speakerAuthorized: true,
})
assert.equal(uncertain.state, 'uncertain')
assert.ok(uncertain.reasons.includes('liveness-unverified'))

const live = classifyVoiceGateEvidence({
  wakeMatched: true,
  speakerAuthorized: true,
  livenessScore: 0.92,
})
assert.equal(live.state, 'live')
assert.equal(live.recommended.submitToBrain, true)
assert.equal(live.recommended.allowWrites, true)

const playback = classifyVoiceGateEvidence({
  wakeMatched: true,
  speakerAuthorized: true,
  replayScore: 0.91,
})
assert.equal(playback.state, 'background')
assert.ok(playback.reasons.includes('probable-playback'))

const status = buildVoiceGateStatus({ env: {} })
assert.equal(status.phase, 'VG-02')
assert.equal(status.mode, 'monitor')
assert.equal(status.hotPathIntegrated, false)
assert.equal(status.safeToEnforce, false)
assert.equal(status.capabilities.wakeWordGate, true)
assert.equal(status.capabilities.householdFocus, true)
assert.equal(typeof status.capabilities.speakerVerificationEngine, 'boolean')
assert.equal(typeof status.capabilities.speakerVerification, 'boolean')
assert.equal(status.capabilities.antiReplay, false)

console.log('L.U.M.I.A. Voice Gate VG-02: PASS')
console.log('Default mode: monitor')
console.log('States: LIVE / UNCERTAIN / BACKGROUND')
console.log('Anti-replay enforcement: intentionally disabled until a provider is calibrated')
