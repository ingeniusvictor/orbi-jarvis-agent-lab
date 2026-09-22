import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  importTeamsTranscript,
  ingestMeetingText,
  markMeetingImportant,
  meetingSnapshot,
  startMeeting,
} from '../bridge/orbia/meeting-service.mjs'

const root = await mkdtemp(join(tmpdir(), 'lumia-meeting-service-cert-'))
const env = { ORBIA_MEETING_ROOT: root }

try {
  await startMeeting({
    id: 'meeting-service-cert',
    title: 'Service cert',
    platform: 'teams',
  }, { env })

  await ingestMeetingText(
    'meeting-service-cert',
    {
      text: 'Tenemos que revisar los trackers.',
      startedAtMs: 1000,
      endedAtMs: 3000,
      source: 'diarization',
      diarizationSpeakerIndex: 0,
    },
    { env },
  )

  await markMeetingImportant(
    'meeting-service-cert',
    { atMs: 1000, note: 'Tracker discussion' },
    { env },
  )

  const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
<v Raul Serrano>Tenemos que revisar los trackers.</v>
`

  const imported = await importTeamsTranscript(
    'meeting-service-cert',
    vtt,
    { env },
  )

  assert.equal(imported.importedTurns, 1)
  assert.equal(imported.canonical[0].speakerName, 'Raul Serrano')

  const snapshot = await meetingSnapshot(
    'meeting-service-cert',
    { env },
  )
  assert.equal(snapshot.transcript.length, 1)
  assert.equal(snapshot.annotations.length, 1)

  console.log('Meeting service orchestration: PASS')
  console.log('Platform-name reconciliation: PASS')
  console.log('Important-moment annotation: PASS')
} finally {
  await rm(root, { recursive: true, force: true })
}
