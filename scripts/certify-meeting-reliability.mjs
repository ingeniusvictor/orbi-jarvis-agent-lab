import assert from 'node:assert/strict'
import {
  getMeetingRuntimeStatus,
  markMeetingRuntimeDegraded,
  resetMeetingRuntimeStatusForTests,
} from '../bridge/orbia/meeting-runtime.mjs'
import { renderMeetingPage } from '../bridge/orbia/meeting-page.mjs'

const fullProbe = () => ({
  provider: 'sherpa-onnx-local',
  available: true,
  packageReady: true,
  runtimeLoadReady: true,
  segmentationReady: true,
  embeddingReady: true,
  runtimeLoadError: null,
})

const blockedProbe = () => ({
  provider: 'sherpa-onnx-local',
  available: false,
  packageReady: true,
  runtimeLoadReady: false,
  segmentationReady: true,
  embeddingReady: true,
  runtimeLoadError: 'An Application Control policy has blocked this file.',
})

resetMeetingRuntimeStatusForTests()
const full = getMeetingRuntimeStatus({ refresh: true, probe: fullProbe })
assert.equal(full.phase, 'MI-05')
assert.equal(full.mode, 'full')
assert.equal(full.roomChunkSeconds, 10)
assert.equal(full.diarization.available, true)
console.log('MI-05 full room preflight: PASS')

const degraded = markMeetingRuntimeDegraded(
  new Error('native diarization failed after startup'),
)
assert.equal(degraded.mode, 'degraded')
assert.equal(degraded.roomChunkSeconds, 3)
assert.equal(degraded.diarization.available, false)
assert.match(degraded.diarization.reason, /native diarization failed/)
console.log('MI-05 runtime failure degrades once: PASS')

const cached = getMeetingRuntimeStatus({ probe: fullProbe })
assert.equal(cached.mode, 'degraded')
assert.equal(cached.roomChunkSeconds, 3)
console.log('MI-05 degraded state is cached: PASS')

const recovered = getMeetingRuntimeStatus({ refresh: true, probe: fullProbe })
assert.equal(recovered.mode, 'full')
assert.equal(recovered.roomChunkSeconds, 10)
console.log('MI-05 next-meeting preflight can recover: PASS')

resetMeetingRuntimeStatusForTests()
const blocked = getMeetingRuntimeStatus({ refresh: true, probe: blockedProbe })
assert.equal(blocked.mode, 'degraded')
assert.equal(blocked.roomChunkSeconds, 3)
assert.match(blocked.diarization.reason, /Application Control/)
console.log('MI-05 Smart App Control fallback profile: PASS')

const page = renderMeetingPage()
assert.match(page, /MI-05/)
assert.match(page, /roomChunkSeconds/)
assert.match(page, /último bloque/i)
assert.match(page, /DEGRADED/)
console.log('MI-05 Meeting Console reliability surface: PASS')
