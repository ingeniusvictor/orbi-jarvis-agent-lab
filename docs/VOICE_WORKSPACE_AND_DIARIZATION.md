# Voice Workspace + Multivoice Diarization

## Why the HUD is split

Raw speech recognition and assistant output are different data streams.

A mixed transcript made it hard to answer three basic questions during household
testing:

1. What did the microphone/Whisper actually hear?
2. What command was eventually sent to O.R.B.I.A.?
3. What did L.U.M.I.A. answer?

The Companion now separates visible speech into dedicated lanes:

```text
LEFT — ESCUCHANDO
  raw STT segments
  live partial transcript
  active recogniser/provider

RIGHT — RESPUESTA
  L.U.M.I.A. answer text only

MULTIVOZ — reserved
  diarized speaker-labelled turns only
  hidden until a real speaker classifier produces evidence
```

The multivoice lane must never infer speakers from punctuation, word choice,
pitch guesses or household context.

## Turn sealing

Whisper runs after a VAD segment has already ended. Household speech can
therefore arrive faster than transcription.

The local path now assigns each queued segment a capture epoch. When a coherent
command is emitted:

- the epoch advances;
- queued later audio is cleared;
- any transcription already in flight under the older epoch is ignored when it
  returns.

This prevents a second person's later speech from being appended merely because
Whisper was still decoding the first command.

It does **not** separate voices that overlap inside the same physical audio
buffer.

## Multivoice provider decision

### whisper.cpp tinydiarize

whisper.cpp supports speaker-turn marking with `-tdrz`, but the model currently
listed for that feature is `small.en-tdrz`. That makes it a poor primary choice
for L.U.M.I.A.'s Spanish household use.

### pyannote Community-1

Strong local diarization option, including speaker counting and exclusive
diarization, but its model access requires accepting Hugging Face conditions and
using an access token for the initial download. It remains a useful future
benchmark.

### sherpa-onnx — preferred first local experiment

The official Node API exposes offline speaker diarization using:

- a pyannote segmentation ONNX model;
- a speaker embedding ONNX model;
- clustering with automatic speaker count;
- mono 16 kHz audio;
- local processing.

This matches the existing Companion architecture well because our Whisper input
is already normalized to mono 16 kHz PCM and the bridge is Node-based.

Target runtime:

```text
.local-runtime/diarization/
  segmentation/model.onnx
  embedding/speaker-embedding.onnx
```

The code currently includes a readiness probe only. No diarization result is
used for routing until the provider is installed and locally certified.

## Planned speaker labels

Initial labels are intentionally anonymous:

```text
SPEAKER 1
SPEAKER 2
SPEAKER 3
```

Later, explicit opt-in enrollment can map a speaker embedding to a local profile
such as:

```text
Victor
Navelys
Máximo
```

Speaker similarity is not authentication and must not be used by itself for
security-sensitive identity decisions.

## Routing policy once diarization is ready

### One speaker detected

Normal command path.

### Two or more sequential speakers

Keep the streams separate in the MULTIVOZ lane. Only the addressed/active turn
is submitted as a command.

### Overlap detected

Do not silently concatenate speakers into one model prompt.

Prefer:

- preserve the separated transcript if the diarizer can resolve it;
- otherwise flag the audio as ambiguous and ask for repetition.

## Current status

Implemented:

- split ESCUCHANDO / RESPUESTA HUD;
- reserved MULTIVOZ HUD;
- raw STT segment store;
- Voice Focus delayed-segment isolation;
- command epoch sealing / stale queue rejection;
- diarization capability probe;
- voice-doctor diarization readiness output.

Pending:

- install sherpa-onnx Node runtime;
- install segmentation + speaker embedding models;
- benchmark CPU latency on the target workstation;
- connect diarized timestamps to Whisper text;
- certify 1, 2 and overlapping speaker scenarios;
- optional authorized speaker enrollment.

## Current implementation boundary

VF-02 has now advanced beyond the readiness probe, but remains intentionally
**off the normal conversation hot path**.

Implemented:

- Windows bootstrap: `npm run voice:setup:diarization`;
- experimental `sherpa-onnx-node` local runtime installation without changing
  the project package manifest;
- official pyannote segmentation + 3D-Speaker embedding model download;
- mono PCM16 WAV decoder for diarization;
- offline speaker segmentation adapter;
- same-speaker segment merge logic;
- per-speaker WAV slicing;
- experimental per-speaker Whisper transcription;
- explicit bridge route: `POST /stt/multivoice`;
- benchmark command:
  `npm run voice:benchmark:multivoice -- "<path-to-16k-mono-pcm16.wav>"`.

The normal `/stt/local` path does **not** invoke diarization yet. That is
deliberate: running diarization plus several Whisper passes on every utterance
could reintroduce the same latency/backlog problem that Speaker Shield just
removed.

Activation gate:

1. current single-speaker + Speaker Shield path passes local testing;
2. diarization runtime is installed and `voice:doctor` reports READY;
3. CPU latency is measured on a real 2-speaker WAV;
4. only then decide whether diarization should run always, conditionally, or
   only in an explicit multivoice mode.

Anonymous labels remain per clip (`SPEAKER 1`, `SPEAKER 2`, ...). No attempt
is made to identify family members until a separate opt-in enrollment design is
implemented.


## Raw STT vs accepted command

Household testing showed that a raw Whisper lane alone can still be misleading.
Acoustic annotations such as `[Música]` and short recognition fragments are
evidence of what the recogniser heard, but they are not necessarily what
O.R.B.I.A. received as the user command.

The HUD now distinguishes:

- `STT`: raw recognised speech segment;
- `GUARD`: speech heard while L.U.M.I.A. is busy;
- `ECO LUMI`: confirmed self-echo;
- `NO VOZ`: acoustic annotation such as music/silence/noise;
- `COMANDO A O.R.B.I.A.`: the final assembled user turn actually submitted
  to the assistant.

Known Whisper non-speech annotations remain visible for debugging but are
dropped before turn assembly.

This separation is important before enabling diarization: multivoice logic must
operate on real speech evidence rather than music/noise annotations or
loudspeaker echo.


## MPPT grounding + truthful wake evidence

A later live test exposed two separate issues:

1. Whisper/model input could surface the observed acronym variant `UMPPT`,
   causing the small local model to invent an unrelated networking definition.
2. Every transcript captured while dormant was visually labeled
   `ACTIVACIÓN`, even when the wake word had not actually matched.

Current hardening:

- local STT normalizes observed full-acronym variants `UMPPT`, `MTTP` and
  `MPTT` to `MPPT`;
- the bounded local Knowledge Engine contains a controlled photovoltaic MPPT
  definition and explicitly states that MPPT is not a communications protocol;
- only a real wake-word match is labeled `ACTIVACIÓN`;
- other speech heard while dormant is labeled `FONDO`, so the HUD no longer
  implies a false wake event.

This keeps raw recognition evidence visible while making both the knowledge path
and the wake diagnostics more truthful.

