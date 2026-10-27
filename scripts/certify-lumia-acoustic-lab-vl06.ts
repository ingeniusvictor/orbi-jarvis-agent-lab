import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  acousticRms,
  acousticDbfs,
  acousticLevelPercent,
  acousticCheckSummary,
} from '../src/lib/acoustic-lab-metrics'

assert.equal(acousticRms(new Float32Array([])), 0)
assert.equal(acousticRms(new Float32Array([0, 0, 0])), 0)
assert.equal(acousticRms(new Float32Array([0.5, -0.5])), 0.5)
assert.ok(Math.abs(acousticRms(new Float32Array([0.25, -0.25, 0.25, -0.25])) - 0.25) < 0.0001)
assert.equal(acousticRms(new Float32Array([NaN, 0.1])), 0)
assert.equal(acousticDbfs(0), -100)
assert.equal(acousticDbfs(NaN), -100)
assert.equal(acousticDbfs(1), 0)
assert.ok(Math.abs(acousticDbfs(0.5) + 6.0206) < 0.001)
assert.equal(acousticLevelPercent(-100), 0)
assert.equal(acousticLevelPercent(-65), 0)
assert.equal(acousticLevelPercent(-10), 100)
assert.equal(acousticLevelPercent(0), 100)
assert.equal(acousticLevelPercent(-37.5), 50)
assert.equal(acousticLevelPercent(NaN), 0)

assert.deepEqual(acousticCheckSummary({
  micPeakDbfs: null, toneRequested: false, toneHeardConfirmed: false,
}), {
  micPeakDbfs: null,
  micAboveFloor: false,
  toneRequested: false,
  toneHeardConfirmed: false,
  hardwareCertified: false,
  rawAudioStored: false,
})
assert.deepEqual(acousticCheckSummary({
  micPeakDbfs: -20.143, toneRequested: true, toneHeardConfirmed: true,
}), {
  micPeakDbfs: -20.1,
  micAboveFloor: true,
  toneRequested: true,
  toneHeardConfirmed: true,
  hardwareCertified: false,
  rawAudioStored: false,
})
assert.equal(acousticCheckSummary({
  micPeakDbfs: -48, toneRequested: true, toneHeardConfirmed: true,
}).micAboveFloor, false)
assert.equal(acousticCheckSummary({
  micPeakDbfs: -10, toneRequested: false, toneHeardConfirmed: true,
}).toneHeardConfirmed, false)

const lab = readFileSync(new URL('../src/ui/AcousticLab.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const pilot = readFileSync(new URL('../src/ui/RealtimeTrial.tsx', import.meta.url), 'utf8')

// Source-level gates certify that microphone access is behind explicit user
// clicks, is cloned instead of stopping a shared stream, and is never played
// through the output. Hardware behavior is not asserted by reading source.
assert.match(lab, /onClick=\{\(\) => void begin\(\)\}/)
assert.match(lab, /const stream = await getMic\(\)/)
assert.match(lab, /const clone = track\.clone\(\)/)
assert.match(lab, /trackRef\.current\?\.stop\(\)/)
assert.match(lab, /const data = new Float32Array\(/)
assert.match(lab, /input\.connect\(analyser\)/)
assert.doesNotMatch(lab, /input\.connect\(ctx\.destination\)/)
assert.match(lab, /45_000/)
assert.match(lab, /onResumeNormal\(\)/)
assert.ok(lab.indexOf('timeoutRef.current = setTimeout') <
  lab.indexOf('const stream = await getMic()'),
  'The timeout must cover microphone permission waits, not only active recording.')
assert.match(lab, /clone\.addEventListener\('ended'/)
assert.match(lab, /document\.addEventListener\('visibilitychange', closeOnHidden\)/)
assert.match(lab, /if \(!activeRef\.current \|\| disposedRef\.current\) return/)
assert.match(lab, /disposedRef\.current = true/)
assert.match(app, /VITE_LUMIA_ACOUSTIC_LAB === '1'/)
assert.match(app, /experimentOwner\.current \? 'deaf'/)
assert.match(app, /if \(experimentOwner\.current\) return/)
assert.match(app, /suspendForExperiment\('realtime'\)/)
assert.match(app, /suspendForExperiment\('acoustic'\)/)
assert.match(app, /if \(experimentOwner\.current\) return false/)
assert.match(pilot, /if \(!onSuspendNormal\(\)\)/)
assert.match(pilot, /onSuspendNormal: \(\) => boolean/)
assert.doesNotMatch(lab, /\bMediaRecorder\b|\.startRecording\(/)

console.log('LUMIA VL-06 local acoustic checks + exclusive mic ownership: PASS')
console.log('No audio recordings, no automatic API calls or hidden mic activation: PASS')
console.log('Windows microphone/speaker and genuine output quality: NOT TESTED')
