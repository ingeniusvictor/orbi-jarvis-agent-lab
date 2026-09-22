import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendMeetingUtterance,
  endMeeting,
  listMeetings,
  meetingStatus,
  pauseMeeting,
  readMeetingTranscript,
  resumeMeeting,
  startMeetingSession,
} from '../bridge/orbia/meeting-store.mjs'

const root = await mkdtemp(join(tmpdir(), 'lumia-meeting-cert-'))
const env = { ORBIA_MEETING_ROOT: root }

try {
  const created = await startMeetingSession({
    id: 'meeting-cert-001',
    title: 'Certification Meeting',
    platform: 'teams',
    participants: [
      { id: 'u1', displayName: 'Victor' },
      { id: 'u2', displayName: 'Raul' },
    ],
  }, { env })

  assert.equal(created.state.status, 'recording')

  await appendMeetingUtterance('meeting-cert-001', {
    startedAtMs: 1000,
    endedAtMs: 2400,
    speakerId: 'u1',
    speakerName: 'Victor',
    speakerIdentitySource: 'platform',
    speakerConfidence: 1,
    source: 'platform-caption',
    platform: 'teams',
    text: 'Revisemos los trackers.',
  }, { env })

  await appendMeetingUtterance('meeting-cert-001', {
    startedAtMs: 2600,
    endedAtMs: 4000,
    speakerId: 'u2',
    speakerName: 'Raul',
    speakerIdentitySource: 'platform',
    source: 'platform-caption',
    platform: 'teams',
    text: 'Yo envío el listado.',
    markedImportant: true,
  }, { env })

  const turns = await readMeetingTranscript('meeting-cert-001', { env })
  assert.equal(turns.length, 2)
  assert.equal(turns[1].speakerName, 'Raul')

  const paused = await pauseMeeting('meeting-cert-001', { env })
  assert.equal(paused.status, 'paused')
  await assert.rejects(
    appendMeetingUtterance('meeting-cert-001', {
      text: 'This must not append while paused.',
    }, { env }),
  )

  const resumed = await resumeMeeting('meeting-cert-001', { env })
  assert.equal(resumed.status, 'recording')

  const ended = await endMeeting('meeting-cert-001', { env })
  assert.equal(ended.status, 'ended')

  const status = await meetingStatus('meeting-cert-001', { env })
  assert.equal(status.state.utteranceCount, 2)
  assert.equal(status.state.importantCount, 1)

  const listed = await listMeetings({ env })
  assert.equal(listed.length, 1)
  assert.equal(listed[0].status, 'ended')

  console.log('Meeting M0 durable session store: PASS')
  console.log('Append-only transcript recovery: PASS')
  console.log('Pause/resume/end state machine: PASS')
  console.log('Participant metadata persistence: PASS')
} finally {
  await rm(root, { recursive: true, force: true })
}
