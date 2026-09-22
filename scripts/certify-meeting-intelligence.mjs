import assert from 'node:assert/strict'
import {
  buildMeetingAnalysisPrompt,
  chunkMeetingTurns,
  meetingTurnsToText,
} from '../bridge/orbia/meeting-intelligence.mjs'
import {
  renderMeetingMarkdown,
  renderMeetingSummaryMarkdown,
  renderMeetingVtt,
} from '../bridge/orbia/meeting-export.mjs'

const turns = [
  {
    startedAtMs: 1000,
    endedAtMs: 3000,
    speakerName: 'Raul',
    text: 'Victor revisa los trackers mañana.',
  },
  {
    startedAtMs: 3500,
    endedAtMs: 5000,
    speakerName: 'Victor',
    text: 'Sí, yo los reviso.',
  },
]

const text = meetingTurnsToText(turns)
assert.ok(text.includes('Raul:'))
assert.ok(text.includes('Victor:'))

const chunks = chunkMeetingTurns(turns, 60)
assert.ok(chunks.length >= 2)

const prompt = buildMeetingAnalysisPrompt({
  title: 'O&M',
  participants: [{ displayName: 'Victor' }, { displayName: 'Raul' }],
  transcript: text,
})
assert.ok(prompt.includes('PARTICIPANTES CONOCIDOS'))
assert.ok(prompt.includes('accepted'))

const md = renderMeetingMarkdown({
  metadata: { title: 'O&M', platform: 'teams' },
  participants: [{ displayName: 'Victor' }],
  turns,
})
assert.ok(md.includes('# O&M'))
assert.ok(md.includes('**[00:00:01] Raul**'))

const vtt = renderMeetingVtt(turns)
assert.ok(vtt.startsWith('WEBVTT'))
assert.ok(vtt.includes('<v Raul>'))

const summary = renderMeetingSummaryMarkdown({
  summary: 'Se revisaron trackers.',
  topics: ['Trackers'],
  decisions: [],
  actionItems: [{ task: 'Revisar trackers', owner: 'Victor', due: 'mañana' }],
  openQuestions: [],
})
assert.ok(summary.includes('Revisar trackers'))

console.log('Meeting M4 intelligence contracts: PASS')
console.log('Long transcript chunking: PASS')
console.log('Markdown/WebVTT artifact rendering: PASS')
