import assert from 'node:assert/strict'
import { renderMeetingPage } from '../bridge/orbia/meeting-page.mjs'

const html = renderMeetingPage()

assert.ok(html.includes('width:min(1720px,calc(100vw - 24px))'))
assert.ok(html.includes('grid-template-columns:minmax(286px,320px) minmax(0,1fr)'))
assert.ok(html.includes('MI-03'))
assert.ok(html.includes('speakerTracking'))
assert.ok(html.includes('expectedParticipants'))
assert.ok(html.includes('Participantes esperados'))
assert.ok(html.includes('Transcripción en vivo'))
assert.equal(html.includes('main{max-width:1100px'), false)

console.log('MI-03 Meeting Console responsive workspace: PASS')
console.log('Transcript-first desktop layout: PASS')
console.log('Live speaker-tracking status surface: PASS')
