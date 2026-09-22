/**
 * Durable local Meeting Intelligence store.
 *
 * Every finalized utterance is appended immediately to transcript.jsonl.
 * Metadata/state writes are atomic. The raw meeting audio is not persisted by
 * this layer; audio retention is a separate explicit policy.
 */

import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  normalizeMeetingUtterance,
  normalizeParticipant,
} from './meeting-contracts.mjs'

const rootFrom = (env = process.env) =>
  resolve(
    env.ORBIA_MEETING_ROOT?.trim() ||
      join(process.cwd(), '.local-runtime', 'meetings'),
  )

const safeId = (value) => {
  const id = String(value ?? '').trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,120}$/.test(id)) {
    throw new Error('invalid meeting id')
  }
  return id
}

const meetingDir = (meetingId, env = process.env) =>
  join(rootFrom(env), safeId(meetingId))

const nowIso = () => new Date().toISOString()

const makeId = () => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return 'meeting-' + stamp.toLowerCase()
}

async function writeJsonAtomic(path, value) {
  const temp = path + '.tmp'
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  await rename(temp, path)
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

export async function startMeetingSession(
  {
    id = null,
    title = '',
    platform = 'generic',
    meetingExternalId = null,
    participants = [],
    saveAudio = false,
  } = {},
  { env = process.env } = {},
) {
  const meetingId = safeId(id || makeId())
  const dir = meetingDir(meetingId, env)
  if (existsSync(dir)) throw new Error('meeting already exists')

  await mkdir(dir, { recursive: true })

  const createdAt = nowIso()
  const metadata = {
    version: 1,
    id: meetingId,
    title: String(title || '').trim().slice(0, 300) || 'Untitled meeting',
    platform: String(platform || 'generic').trim().slice(0, 40),
    meetingExternalId:
      meetingExternalId == null
        ? null
        : String(meetingExternalId).trim().slice(0, 500),
    createdAt,
    endedAt: null,
    saveAudio: Boolean(saveAudio),
  }

  const normalizedParticipants = participants.map(normalizeParticipant)
  const state = {
    version: 1,
    id: meetingId,
    status: 'recording',
    startedAt: createdAt,
    pausedAt: null,
    endedAt: null,
    utteranceCount: 0,
    importantCount: 0,
    lastUtteranceAt: null,
    lastCheckpointAt: createdAt,
  }

  await Promise.all([
    writeJsonAtomic(join(dir, 'metadata.json'), metadata),
    writeJsonAtomic(join(dir, 'participants.json'), normalizedParticipants),
    writeJsonAtomic(join(dir, 'state.json'), state),
    writeFile(join(dir, 'transcript.jsonl'), '', 'utf8'),
  ])

  return Object.freeze({ ...metadata, state })
}

export async function meetingStatus(
  meetingId,
  { env = process.env } = {},
) {
  const dir = meetingDir(meetingId, env)
  const [metadata, state, participants] = await Promise.all([
    readJson(join(dir, 'metadata.json')),
    readJson(join(dir, 'state.json')),
    readJson(join(dir, 'participants.json'), []),
  ])
  if (!metadata || !state) throw new Error('meeting not found')
  return Object.freeze({
    metadata: Object.freeze(metadata),
    state: Object.freeze(state),
    participants: Object.freeze(participants),
  })
}

export async function replaceMeetingParticipants(
  meetingId,
  participants,
  { env = process.env } = {},
) {
  const dir = meetingDir(meetingId, env)
  const normalized = participants.map(normalizeParticipant)
  await writeJsonAtomic(join(dir, 'participants.json'), normalized)
  return Object.freeze(normalized)
}

export async function appendMeetingUtterance(
  meetingId,
  input,
  { env = process.env } = {},
) {
  const dir = meetingDir(meetingId, env)
  const status = await meetingStatus(meetingId, { env })
  if (status.state.status !== 'recording') {
    throw new Error('meeting is not recording')
  }

  const utterance = normalizeMeetingUtterance(input)
  await appendFile(
    join(dir, 'transcript.jsonl'),
    JSON.stringify(utterance) + '\n',
    'utf8',
  )

  const nextState = {
    ...status.state,
    utteranceCount: status.state.utteranceCount + 1,
    importantCount:
      status.state.importantCount + (utterance.markedImportant ? 1 : 0),
    lastUtteranceAt: utterance.receivedAt,
    lastCheckpointAt: nowIso(),
  }
  await writeJsonAtomic(join(dir, 'state.json'), nextState)
  return utterance
}

export async function readMeetingTranscript(
  meetingId,
  { env = process.env } = {},
) {
  const path = join(meetingDir(meetingId, env), 'transcript.jsonl')
  let raw = ''
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new Error('meeting not found')
  }

  const turns = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      turns.push(JSON.parse(line))
    } catch {
      // A partially written final line after a crash is ignored; all complete
      // earlier JSONL records remain recoverable.
    }
  }
  return Object.freeze(turns)
}

async function transitionMeeting(
  meetingId,
  nextStatus,
  { env = process.env } = {},
) {
  const dir = meetingDir(meetingId, env)
  const current = await meetingStatus(meetingId, { env })
  const state = { ...current.state }

  if (nextStatus === 'paused' && state.status === 'recording') {
    state.status = 'paused'
    state.pausedAt = nowIso()
  } else if (nextStatus === 'recording' && state.status === 'paused') {
    state.status = 'recording'
    state.pausedAt = null
  } else if (nextStatus === 'ended' && state.status !== 'ended') {
    state.status = 'ended'
    state.endedAt = nowIso()
    const metadata = { ...current.metadata, endedAt: state.endedAt }
    await writeJsonAtomic(join(dir, 'metadata.json'), metadata)
  } else {
    throw new Error('invalid meeting state transition')
  }

  state.lastCheckpointAt = nowIso()
  await writeJsonAtomic(join(dir, 'state.json'), state)
  return Object.freeze(state)
}

export const pauseMeeting = (meetingId, options) =>
  transitionMeeting(meetingId, 'paused', options)

export const resumeMeeting = (meetingId, options) =>
  transitionMeeting(meetingId, 'recording', options)

export const endMeeting = (meetingId, options) =>
  transitionMeeting(meetingId, 'ended', options)

export async function listMeetings({ env = process.env } = {}) {
  const root = rootFrom(env)
  let entries = []
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return Object.freeze([])
  }

  const meetings = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const status = await meetingStatus(entry.name, { env })
      meetings.push({
        id: status.metadata.id,
        title: status.metadata.title,
        platform: status.metadata.platform,
        createdAt: status.metadata.createdAt,
        endedAt: status.metadata.endedAt,
        status: status.state.status,
        utteranceCount: status.state.utteranceCount,
      })
    } catch {
      // Ignore unrelated or incomplete directories.
    }
  }

  meetings.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return Object.freeze(meetings)
}

export async function deleteMeeting(
  meetingId,
  { env = process.env } = {},
) {
  await rm(meetingDir(meetingId, env), { recursive: true, force: true })
  return true
}
