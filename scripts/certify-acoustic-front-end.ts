import assert from 'node:assert/strict'
import {
  ACOUSTIC_DEFAULTS,
  AdaptiveAcousticFrontEnd,
} from '../src/lib/acoustic-front-end'

const model = new AdaptiveAcousticFrontEnd()

let idle
for (let i = 0; i < ACOUSTIC_DEFAULTS.calibrationFrames + 5; i++) {
  idle = model.observe(0.01)
}
assert.ok(idle)
assert.equal(idle.calibrated, true)
assert.ok(idle.floor > 0)
assert.ok(idle.threshold > idle.floor)
assert.equal(idle.echoBaseline, 0)

const beforeEchoFloor = idle.floor
let echo
for (let i = 0; i < 40; i++) {
  echo = model.observe(0.08, {
    guard: true,
    suppressed: true,
  })
}
assert.ok(echo)
assert.ok(echo.echoBaseline > 0.01)
assert.equal(echo.suppressed, true)

// Speaker playback must not contaminate ambient noise calibration.
assert.ok(Math.abs(echo.floor - beforeEchoFloor) < 0.002)

const after = model.observe(0.025, {
  guard: false,
  suppressed: false,
})
assert.ok(after.floorRatio > 0)
assert.ok(after.echoRatio >= 0)

const guarded = model.snapshot(true)
const normal = model.snapshot(false)
assert.ok(guarded.threshold > normal.threshold)

console.log('VG-03A acoustic front-end: PASS')
console.log('Ambient floor calibration: PASS')
console.log('Speaker echo baseline isolation: PASS')
console.log('Guard threshold compatibility: PASS')
