import assert from 'node:assert/strict'
import { probeWakeEngine } from '../bridge/orbia/wake-engine-probe.mjs'

const missing = probeWakeEngine({
  env: {},
  exists: () => false,
})
assert.equal(missing.canonical, 'openwakeword')
assert.equal(missing.selected, 'transcript')
assert.equal(missing.dedicatedReady, false)
assert.equal(missing.transcriptFallback, true)

const open = probeWakeEngine({
  env: { ORBIA_WAKE_ENGINE: 'auto' },
  exists: (path) =>
    path.endsWith('python.exe') ||
    path.endsWith('lumi.onnx'),
})
assert.equal(open.selected, 'openwakeword')
assert.equal(open.dedicatedReady, true)

const porcupineWithoutKey = probeWakeEngine({
  env: { ORBIA_WAKE_ENGINE: 'porcupine' },
  exists: (path) => path.endsWith('lumi.ppn'),
})
assert.equal(porcupineWithoutKey.selected, 'transcript')

console.log('Dedicated wake-engine readiness contract: PASS')
console.log('openWakeWord is canonical when locally ready.')
console.log('Porcupine is never auto-selected.')
console.log('Transcript wake matching remains a safe fallback.')
