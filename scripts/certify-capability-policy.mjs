import assert from 'node:assert/strict'
import {
  canRememberCapability,
  classifyCapability,
} from '../bridge/orbia/capability-policy.mjs'

const read = classifyCapability('mcp__exa__search')
assert.equal(read.level, 'N1')
assert.equal(read.remoteAllowed, true)
assert.equal(read.requiresLiveHuman, false)

const edit = classifyCapability('mcp__jarvis_chrome__type')
assert.equal(edit.level, 'N2')
assert.equal(edit.rememberable, true)
assert.equal(edit.requiresAuthorizedSpeaker, true)

const mail = classifyCapability('mcp__gmail__send_email')
assert.equal(mail.level, 'N3')
assert.equal(mail.confirmation, 'fresh')
assert.equal(mail.rememberable, false)
assert.equal(mail.requiresLiveHuman, true)
assert.equal(mail.remoteAllowed, false)

const deleteTool = classifyCapability('Delete')
assert.equal(deleteTool.level, 'N3')

assert.equal(canRememberCapability('mcp__jarvis_chrome__type'), true)
assert.equal(canRememberCapability('mcp__gmail__send_email'), false)

console.log('L8 capability policy: PASS')
console.log('N1 read-only routing: PASS')
console.log('N2 reversible action classification: PASS')
console.log('N3 fresh-confirmation boundary: PASS')
