import assert from 'node:assert/strict'
import { selectToolDomains } from '../bridge/orbia/tool-domain-router.mjs'

assert.deepEqual(
  selectToolDomains('Hola, ¿cómo estás?').domains,
  [],
)

assert.deepEqual(
  selectToolDomains('Revisa mi agenda y mis correos').domains,
  ['calendar', 'mail'],
)

const screen = selectToolDomains('Mira mi pantalla y lee este error')
assert.ok(screen.domains.includes('vision'))

const research = selectToolDomains(
  'Investiga en internet y compara estos tres micrófonos',
)
assert.ok(research.domains.includes('research'))
assert.ok(research.domains.includes('web'))

const browser = selectToolDomains('Haz clic en el botón de Chrome')
assert.ok(browser.domains.includes('browser'))
assert.ok(browser.domains.includes('vision'))

const unknown = selectToolDomains('Modifica este ajuste misterioso')
assert.equal(unknown.mode, 'full')
assert.equal(unknown.domains, null)

console.log('L7 tool domain router: PASS')
console.log('Casual conversation exposes no tool domains: PASS')
console.log('Multi-domain requests combine scopes: PASS')
console.log('Unknown actions fail open to the full registry: PASS')
