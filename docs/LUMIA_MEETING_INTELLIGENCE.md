# L.U.M.I.A. Meeting Intelligence — MI-04

## Goal

Provide a local-first meeting transcription and intelligence layer for Microsoft
Teams, Zoom, Google Meet and physical meetings without requiring a third-party
meeting bot.

## Canonical pipeline

```
microphone -----------------------------+
                                        |
shared/system audio -> local Whisper ---+--> durable JSONL transcript
                                        |
platform captions / transcript --------+--> identity evidence
                                        |
local diarization ----------------------+--> anonymous fallback
                                             |
                                             v
                                      canonical transcript
                                             |
                                 +-----------+-----------+
                                 |                       |
                              Ollama                  exports
                      summary / decisions /       Markdown / VTT
                       tasks / questions
```

## Identity precedence

1. Explicit platform identity (Teams/Zoom/Meet).
2. Manual user correction.
3. Enrolled local speaker profile when actually verified.
4. Anonymous sherpa-onnx diarization.
5. Unknown speaker.

Never infer a person's identity from screen position, avatar colour, tile order,
or an unverified voice guess.

## Microsoft Teams

### Live capture

The Meeting Console can capture:

- the local microphone through `getUserMedia`;
- browser/system shared audio through `getDisplayMedia` when the browser and
  operating system expose an audio track.

Audio is converted locally to mono PCM16 WAV and sent to the local bridge in
short chunks. The default implementation does not retain raw audio.

Live explicit names can be ingested through the platform-caption contract when
a trusted Teams integration provides them. MI-01 does not scrape unstable Teams
DOM selectors and does not guess names.

### Post-meeting reconciliation

Microsoft Graph can expose Teams meeting transcripts. Speaker-attributed WebVTT
uses `<v Speaker Name>` voice tags when the tenant permits attributed
transcripts. Access is tenant-controlled and requires Microsoft Graph
permissions.

The raw local transcript is preserved. A Teams VTT import creates a separate
platform evidence artifact and a canonical reconciled transcript.

References checked September 2026:

- https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts
- https://learn.microsoft.com/en-us/graph/api/calltranscript-get
- https://learn.microsoft.com/en-us/microsoftteams/meeting-transcript-api-access

## Durability

Each finalized utterance is appended immediately to:

`.local-runtime/meetings/<meeting-id>/transcript.jsonl`

State and participant metadata use atomic JSON writes. Derived files are
regenerable and live under `derived/`.

A crash can at worst leave one incomplete final JSONL line; prior complete
utterances remain readable.

## Local artifacts

Typical meeting directory:

```
meeting-.../
  metadata.json
  state.json
  participants.json
  transcript.jsonl
  annotations.jsonl
  derived/
    teams-transcript.vtt
    teams-transcript.json
    canonical-transcript.json
    transcript.md
    transcript.vtt
    intelligence.json
    summary.md
    action-items.json
```

## Privacy defaults

- Raw audio retention: OFF.
- Transcript persistence: ON after the user starts Meeting Mode.
- Other-person biometric enrollment: OFF.
- Platform names are preferred over biometric identity.
- Local speaker verification is used only when an enrolled profile exists and a
  chunk is suitable for verification.
- A visible red Meeting Mode indicator is mandatory while capture is active.
- Users are responsible for informing participants and following workplace and
  jurisdictional recording/transcription requirements.

## Long meetings

Transcription is incremental and not limited to one commercial one-hour window.
Audio is processed in short chunks and transcript evidence is persisted as it
arrives.

Meeting intelligence uses bounded chunks. Long transcripts are analyzed in
parts and consolidated so multi-hour meetings do not require one giant prompt.

## Controls

Meeting Console:

`http://127.0.0.1:8787/meeting`

Supported controls in MI-01:

- start meeting;
- microphone capture;
- system/shared audio capture;
- pause/resume;
- mark important moment;
- end meeting;
- import Teams WebVTT;
- generate local summary/tasks/decisions;
- query the meeting.

## Current boundary

MI-01 provides the complete local core and platform-ingest contracts.

Not yet claimed as certified:

- automatic live Teams display-name acquisition from the desktop client;
- Graph authentication on behalf of a Microsoft tenant;
- stable cross-chunk diarization identity in all acoustic conditions;
- automatic task creation in external work-management systems.

Those capabilities must be added and certified independently rather than
silently inferred.


## MI-02 — persistent room speaker tracking

Presential microphone capture now runs through local diarization before
transcription. Each local diarization cluster is converted into a 512-dimensional
speaker embedding and compared with the active meeting's in-memory centroids.

The result is a stable meeting-local identity such as `SPEAKER 1` or
`SPEAKER 2` across successive audio chunks. If the primary user's enrolled
profile is available and matches, that speaker is labeled with the configured
local user name instead.

Privacy boundary:

- anonymous participant embeddings exist only in process memory;
- they are not written to `.local-runtime/meetings`;
- raw audio remains OFF by default;
- ending the meeting clears the in-memory tracker;
- a bridge restart loses anonymous biometric continuity rather than persisting
  other people's biometric templates.

The default cross-chunk match threshold is conservative and configurable through
`ORBIA_MEETING_SPEAKER_TRACK_THRESHOLD` (default 0.68).

## MI-02 console layout

Desktop Meeting Console now uses the available viewport rather than a fixed
1100-pixel canvas. The controls live in a compact scrolling sidebar while the
transcript receives the remaining horizontal and vertical space. The header
shows MI-02 tracking state and anonymous speaker count when room tracking is
active.


## MI-03 — adaptive speaker consolidation

MI-03 addresses over-segmentation observed in real room tests where three human
participants could temporarily appear as five or more anonymous speakers.

Changes:

- default cross-chunk strong-match threshold lowered from 0.68 to 0.58;
- meeting-only short-utterance embedding policy accepts useful speech down to
  about 0.85 seconds without weakening Voice Gate enrollment rules;
- optional expected participant count prevents unbounded anonymous speaker
  creation when the user already knows the room size;
- when that optional cap is reached, a softer similarity threshold can reuse an
  existing cluster instead of creating another identity;
- duplicate anonymous clusters can be merged later as their centroids become
  better defined;
- historical transcript turns are projected through the alias map so a merged
  SPEAKER id is shown consistently;
- Unknown speaker is no longer counted as a participant in the console;
- room-mode audio chunks use a slightly longer window to improve diarization
  evidence while remaining near-live.

Privacy is unchanged: anonymous speaker embeddings remain process-memory only.
The durable transcript can persist non-biometric speaker aliases, but never the
embedding vectors themselves.

The optional expected participant count is a clustering hint, not a claim of
identity. When evidence is too weak after the cap is reached, MI-03 returns
Unknown speaker rather than inventing another person.


## MI-04 — short-turn speaker recovery

MI-04 targets a narrower failure observed after MI-03 fixed speaker explosion:
very short utterances can still fall back to `Unknown speaker`, especially for
higher-pitched or child voices whose useful voiced segment is brief.

Changes:

- meeting-only embedding accepts short evidence down to about 0.45 seconds;
- short evidence can match an already-established speaker;
- short evidence cannot create a new speaker by itself;
- when the expected participant count is already reached, a separate
  conservative short-turn threshold may recover the closest established
  speaker;
- recovered short turns do not update the speaker centroid, preventing weak
  evidence from contaminating the stable meeting-local voice representation;
- the console surfaces the number of short turns recovered during the active
  meeting.

Privacy remains unchanged: anonymous embeddings are process-memory only and raw
audio is not retained by default.

MI-04 deliberately preserves `Unknown speaker` when short evidence is too weak
or ambiguous. The goal is to reduce avoidable unknown turns without forcing a
speaker identity when confidence is insufficient.
