/**
 * L.U.M.I.A. Meeting Intelligence service.
 *
 * Orchestrates durable meeting storage, local speech recognition, platform
 * transcript imports, reconciliation and local intelligence generation.
 */

import {
  appendMeetingAnnotation,
  appendMeetingUtterance,
  endMeeting,
  meetingStatus,
  pauseMeeting,
  readMeetingAnnotations,
  readMeetingDerivedArtifact,
  readMeetingTranscript,
  replaceMeetingParticipants,
  resumeMeeting,
  startMeetingSession,
  writeMeetingDerivedArtifact,
} from './meeting-store.mjs'
import {
  anonymousDiarizationSpeaker,
  resolveSpeakerIdentity,
} from './meeting-speakers.mjs'
import { transcribeLocalWav } from './local-stt.mjs'
import { transcribeMultivoiceLocalWav } from './multivoice-stt.mjs'
import { decodeMonoPcm16Wav } from './speaker-diarization.mjs'
import { parseTeamsTranscriptVtt } from './teams-transcript.mjs'
import { reconcileMeetingTurns } from './meeting-reconcile.mjs'
import {
  generateMeetingIntelligence,
} from './meeting-intelligence.mjs'
import {
  renderMeetingMarkdown,
  renderMeetingSummaryMarkdown,
  renderMeetingVtt,
} from './meeting-export.mjs'
import { answerMeetingQuestion } from './meeting-query.mjs'

const cleanName = (value) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)

export async function startMeeting(input = {}, options = {}) {
  return startMeetingSession(input, options)
}

export async function setMeetingParticipants(
  meetingId,
  participants,
  options = {},
) {
  return replaceMeetingParticipants(meetingId, participants, options)
}

export async function ingestMeetingText(
  meetingId,
  {
    text,
    startedAtMs = 0,
    endedAtMs = startedAtMs,
    source = 'manual',
    platform = null,
    platformSpeakerId = null,
    platformSpeakerName = null,
    localSpeakerName = null,
    localSpeakerAuthorized = null,
    diarizationSpeakerIndex = null,
    language = null,
    markedImportant = false,
  } = {},
  options = {},
) {
  const candidates = []

  if (platformSpeakerName || platformSpeakerId) {
    candidates.push({
      id: platformSpeakerId || null,
      name: platformSpeakerName || null,
      source: 'platform',
      confidence: 1,
    })
  }

  if (localSpeakerName && localSpeakerAuthorized === true) {
    candidates.push({
      id: 'local-primary',
      name: localSpeakerName,
      source: 'local-speaker-profile',
      confidence: 1,
    })
  }

  if (diarizationSpeakerIndex != null) {
    candidates.push(
      anonymousDiarizationSpeaker(diarizationSpeakerIndex),
    )
  }

  const identity = resolveSpeakerIdentity(candidates)

  return appendMeetingUtterance(
    meetingId,
    {
      startedAtMs,
      endedAtMs,
      speakerId: identity.id,
      speakerName: identity.name,
      speakerIdentitySource: identity.source,
      speakerConfidence: identity.confidence,
      source,
      platform,
      text,
      language,
      markedImportant,
    },
    options,
  )
}

export async function ingestMeetingAudioChunk(
  meetingId,
  audio,
  {
    channel = 'microphone',
    offsetMs = 0,
    localSpeakerName = 'LOCAL USER',
    platform = null,
  } = {},
  options = {},
) {
  const baseOffset = Math.max(0, Number(offsetMs) || 0)
  const decoded = decodeMonoPcm16Wav(audio)
  const chunkDurationMs =
    decoded.sampleRate > 0
      ? Math.round((decoded.samples.length / decoded.sampleRate) * 1000)
      : 0

  if (channel === 'microphone') {
    const result = await transcribeLocalWav(audio, options)
    return Object.freeze([
      await ingestMeetingText(
        meetingId,
        {
          text: result.text,
          startedAtMs: baseOffset,
          endedAtMs: baseOffset + chunkDurationMs,
          source: 'microphone',
          platform,
          localSpeakerName: cleanName(localSpeakerName) || 'LOCAL USER',
          localSpeakerAuthorized: true,
          language: result.language,
        },
        options,
      ),
    ])
  }

  if (channel !== 'system-audio') {
    throw new Error('unsupported meeting audio channel')
  }

  const multi = await transcribeMultivoiceLocalWav(audio, options)

  if (multi.turns?.length) {
    const out = []
    for (const turn of multi.turns) {
      out.push(
        await ingestMeetingText(
          meetingId,
          {
            text: turn.text,
            startedAtMs:
              baseOffset + Math.max(0, Number(turn.start) || 0) * 1000,
            endedAtMs:
              baseOffset + Math.max(0, Number(turn.end) || 0) * 1000,
            source: 'diarization',
            platform,
            diarizationSpeakerIndex: turn.speakerId,
            language: 'es',
          },
          options,
        ),
      )
    }
    return Object.freeze(out)
  }

  // A one-speaker chunk is common in calls. VF-02 historically returned no
  // per-speaker turns in that case, so fall back to whole-chunk Whisper rather
  // than silently dropping the audio.
  const single = await transcribeLocalWav(audio, options)
  return Object.freeze([
    await ingestMeetingText(
      meetingId,
      {
        text: single.text,
        startedAtMs: baseOffset,
        endedAtMs: baseOffset + chunkDurationMs,
        source: 'system-audio',
        platform,
        diarizationSpeakerIndex: 0,
        language: single.language,
      },
      options,
    ),
  ])
}

export async function importTeamsTranscript(
  meetingId,
  vtt,
  options = {},
) {
  const platformTurns = parseTeamsTranscriptVtt(vtt)
  const localTurns = await readMeetingTranscript(meetingId, options)
  const status = await meetingStatus(meetingId, options)
  const canonical = reconcileMeetingTurns(localTurns, platformTurns)

  await Promise.all([
    writeMeetingDerivedArtifact(
      meetingId,
      'teams-transcript.vtt',
      String(vtt ?? ''),
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'teams-transcript.json',
      platformTurns,
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'canonical-transcript.json',
      canonical,
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'transcript.md',
      renderMeetingMarkdown({
        metadata: status.metadata,
        participants: status.participants,
        turns: canonical,
      }),
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'transcript.vtt',
      renderMeetingVtt(canonical),
      options,
    ),
  ])

  return Object.freeze({
    importedTurns: platformTurns.length,
    localTurns: localTurns.length,
    canonicalTurns: canonical.length,
    canonical,
  })
}

export async function canonicalMeetingTranscript(
  meetingId,
  options = {},
) {
  try {
    return Object.freeze(
      JSON.parse(
        await readMeetingDerivedArtifact(
          meetingId,
          'canonical-transcript.json',
          options,
        ),
      ),
    )
  } catch {
    return readMeetingTranscript(meetingId, options)
  }
}

export async function analyzeMeeting(
  meetingId,
  options = {},
) {
  const status = await meetingStatus(meetingId, options)
  const turns = await canonicalMeetingTranscript(meetingId, options)
  const intelligence = await generateMeetingIntelligence(
    {
      title: status.metadata.title,
      participants: status.participants,
      turns,
    },
    options,
  )

  await Promise.all([
    writeMeetingDerivedArtifact(
      meetingId,
      'intelligence.json',
      intelligence,
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'summary.md',
      renderMeetingSummaryMarkdown(intelligence),
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'action-items.json',
      intelligence.actionItems ?? [],
      options,
    ),
  ])

  return intelligence
}

export async function refreshMeetingTranscriptArtifacts(
  meetingId,
  options = {},
) {
  const status = await meetingStatus(meetingId, options)
  const turns = await canonicalMeetingTranscript(meetingId, options)

  await Promise.all([
    writeMeetingDerivedArtifact(
      meetingId,
      'transcript.md',
      renderMeetingMarkdown({
        metadata: status.metadata,
        participants: status.participants,
        turns,
      }),
      options,
    ),
    writeMeetingDerivedArtifact(
      meetingId,
      'transcript.vtt',
      renderMeetingVtt(turns),
      options,
    ),
  ])

  return Object.freeze({
    turns: turns.length,
  })
}

export async function markMeetingImportant(
  meetingId,
  {
    atMs = null,
    utteranceId = null,
    note = '',
  } = {},
  options = {},
) {
  return appendMeetingAnnotation(
    meetingId,
    {
      type: 'important',
      atMs,
      utteranceId,
      note,
    },
    options,
  )
}

export async function queryMeeting(
  meetingId,
  question,
  options = {},
) {
  const turns = await canonicalMeetingTranscript(meetingId, options)
  return answerMeetingQuestion(question, turns, options)
}

export function applyMeetingAnnotations(turns = [], annotations = []) {
  const important = annotations.filter((x) => x?.type === 'important')
  if (!important.length) return Object.freeze(turns.map((turn) => ({ ...turn })))

  return Object.freeze(
    turns.map((turn, index) => {
      const matches = important.filter((annotation) => {
        if (annotation.utteranceId) return annotation.utteranceId === turn.id
        if (!Number.isFinite(Number(annotation.atMs))) return false

        const at = Number(annotation.atMs)
        const start = Number(turn.startedAtMs) || 0
        const nextStart =
          index + 1 < turns.length
            ? Number(turns[index + 1]?.startedAtMs) || Number.POSITIVE_INFINITY
            : Number.POSITIVE_INFINITY

        return at >= start && at < nextStart
      })

      if (!matches.length) return { ...turn }
      return {
        ...turn,
        markedImportant: true,
        importantNotes: matches
          .map((x) => String(x.note || '').trim())
          .filter(Boolean),
      }
    }),
  )
}

export async function meetingSnapshot(meetingId, options = {}) {
  const [status, transcript, annotations] = await Promise.all([
    meetingStatus(meetingId, options),
    canonicalMeetingTranscript(meetingId, options),
    readMeetingAnnotations(meetingId, options),
  ])

  return Object.freeze({
    ...status,
    transcript: applyMeetingAnnotations(transcript, annotations),
    annotations,
  })
}

export {
  endMeeting,
  pauseMeeting,
  resumeMeeting,
}
