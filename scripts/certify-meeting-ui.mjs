import assert from 'node:assert/strict'
import { renderMeetingPage } from '../bridge/orbia/meeting-page.mjs'

const html = renderMeetingPage()

assert.ok(html.includes('width:min(1720px,calc(100vw - 24px))'))
assert.ok(html.includes('grid-template-columns:minmax(286px,320px) minmax(0,1fr)'))
assert.ok(html.includes('MI-05'))
assert.ok(html.includes('speakerTracking'))
assert.ok(html.includes('expectedParticipants'))
assert.ok(html.includes('Participantes esperados'))
assert.ok(html.includes('shortRecoveryCount'))
assert.ok(html.includes('Transcripción en vivo'))
assert.ok(html.includes('DEGRADED'))
assert.ok(html.includes('último bloque'))
assert.equal(html.includes('main{max-width:1100px'), false)

console.log('MI-05 Meeting Console responsive workspace: PASS')
console.log('Transcript-first desktop layout: PASS')
console.log('Live speaker-tracking status surface: PASS')
console.log('Adaptive reliability status surface: PASS')
