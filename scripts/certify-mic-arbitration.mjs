import assert from 'node:assert/strict'
import {
  MicArbitrator,
  weightedWakeScore,
} from '../bridge/orbia/mic-arbitration.mjs'

assert.equal(weightedWakeScore(0.8, 1), 0.8)
assert.equal(weightedWakeScore(0.8, 1.2), 0.96)
assert.equal(weightedWakeScore(Number.NaN, 1), 0)

const arbiter = new MicArbitrator({
  windowMs: 20,
  lockMs: 120,
})

const desktop = arbiter.reserve('desktop', 0.66)
const kitchen = arbiter.reserve('edge:kitchen', 0.91)
const phone = arbiter.reserve('edge:phone', 0.72, { priority: 1.1 })

assert.equal(await desktop, false)
assert.equal(await kitchen, true)
assert.equal(await phone, false)

const locked = arbiter.status()
assert.equal(locked.owner, 'edge:kitchen')
assert.equal(locked.locked, true)

assert.equal(await arbiter.reserve('desktop', 0.99), false)
assert.equal(await arbiter.reserve('edge:kitchen', 0.2), true)

assert.equal(arbiter.release('desktop'), false)
assert.equal(arbiter.release('edge:kitchen'), true)
assert.equal(arbiter.status().locked, false)

const tie = new MicArbitrator({ windowMs: 15, lockMs: 100 })
const first = tie.reserve('first', 0.8)
const second = tie.reserve('second', 0.8)
assert.equal(await first, true)
assert.equal(await second, false)

console.log('VG-04 multi-microphone arbitration: PASS')
console.log('Highest weighted wake confidence wins: PASS')
console.log('Lock prevents duplicate room responses: PASS')
console.log('Tie breaks deterministically by first detection: PASS')
