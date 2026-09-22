import assert from 'node:assert/strict'
import {
  redactForLog,
  redactSensitiveText,
} from '../bridge/orbia/privacy-redaction.mjs'

const sample =
  'Contacta test@example.com con token sk-' +
  'a'.repeat(24) +
  ' y teléfono +56 9 1234 5678.'

const redacted = redactSensitiveText(sample)
assert.equal(redacted.includes('test@example.com'), false)
assert.equal(redacted.includes('sk-'), false)
assert.equal(redacted.includes('+56 9 1234 5678'), false)
assert.ok(redacted.includes('[email]'))
assert.ok(redacted.includes('[secret]'))
assert.ok(redacted.includes('[number]'))

const bounded = redactForLog('palabra '.repeat(200), 120)
assert.ok(bounded.length <= 121)

console.log('L9 privacy redaction: PASS')
console.log('Email/secret/long-number masking: PASS')
console.log('Bounded log rendering: PASS')
