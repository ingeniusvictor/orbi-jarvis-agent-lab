# Voice Focus — household speech robustness

## Goal

L.U.M.I.A. should remain usable in a real home where more than one person may
speak near the microphone.

This problem is separate from the LLM. Once Whisper has merged two speakers into
one transcript, a larger Qwen model cannot reliably reconstruct who intended
which words.

## VF-00 — delayed-segment isolation — IMPLEMENTED

The first problem found on the target workstation was deterministic:

1. an adult finishes a command;
2. Whisper is still decoding that audio;
3. another person begins speaking;
4. the previous code inspected the microphone's *current* speech state when the
   older transcript returned;
5. the assembler could therefore treat the second speaker as a continuation of
   the first speaker.

The current fix:

- tags every queued VAD segment with the mode in which it was captured;
- discards queued command audio if that command has already closed;
- never treats current microphone activity as proof that the same speaker is
  continuing a finished Whisper segment;
- preserves guard -> command transition for legitimate barge-in;
- exposes a `staleSegments` diagnostic counter.

This reduces sequential household cross-talk without changing model behavior or
requiring speaker biometrics.

## Important limitation

VF-00 cannot separate two voices that are physically present in the **same audio
segment**.

Example:

```text
Adult:  "Lumi, explícame qué es un MPPT..."
Child:             "...speech overlaps here..."
                         ↓
                  one microphone buffer
                         ↓
                      Whisper
```

If Whisper itself returns one mixed transcript, turn isolation cannot determine
which words belonged to which person.

## VF-01 — Household Focus interruption policy — IMPLEMENTED FOR LOCAL WHISPER

Add a selectable policy:

### Natural

- current free-form barge-in behavior;
- best in a quiet one-person environment.

### Household Focus

- while L.U.M.I.A. is thinking/speaking, ambient speech does not immediately
  cancel the answer;
- interruption requires the wake name ("Lumi") or an explicit interrupt phrase
  such as "para", "espera" or "cancela";
- normal command capture remains unchanged while L.U.M.I.A. is listening.

This is not speaker identification. It is a safer turn-taking policy for a noisy
home.

## VF-02 — optional Speaker Focus

Later, add a local speaker-profile layer before accepting a command:

```text
Microphone
   ↓
VAD
   ↓
speaker embedding / similarity
   ├── primary enrolled speaker -> priority command
   └── other/unknown speaker -> background or separate interaction
   ↓
Whisper
```

Requirements:

- local-first;
- opt-in enrollment;
- voice owner authorization;
- store only the minimum profile representation required;
- do not make identity/security decisions solely from voice similarity;
- do not silently discard a person who intentionally addresses L.U.M.I.A.

## VF-03 — child interaction profile

A future child mode must be deliberately different from adult speaker focus.

Principles:

- do not treat ASR uncertainty as a pronunciation error;
- allow slower/shorter utterances and repetitions;
- keep the child as an intentional speaker when child mode is active;
- use age-appropriate vocabulary and interaction pacing;
- avoid scoring speech solely from general-purpose Whisper output;
- preserve the existing L.U.M.I.A. Kids boundary: companion/practice tool, not a
  replacement for professional or school support.

## Certification scenarios

### Scenario A — sequential cross-talk

Adult asks a complete question. Another person speaks immediately afterward.

Expected after VF-00:

- the adult command is sent once;
- queued later speech does not get appended to that command;
- the later segment cannot interrupt the answer merely because transcription
  completed late.

### Scenario B — true simultaneous overlap

Two people speak during the same VAD segment.

Expected after VF-00:

- no guarantee of speaker separation;
- record the transcript quality;
- use the result to decide whether VF-02 diarization/speaker embedding is needed.

### Scenario C — long adult dictation

Adult pauses naturally within one long question.

Expected:

- long-utterance protection remains intact;
- no regression from the VF-00 isolation change.

## Current command

```bash
npm run certify:voice-focus
```


### Live household test finding

The split HUD confirmed that GUARD speech from nearby people was being
transcribed correctly into the raw ESCUCHANDO lane, but the VAD path still
interrupted L.U.M.I.A. before the transcript could be classified.

VF-01 now changes the local-Whisper guard behavior:

- busy-time speech is still transcribed and shown in ESCUCHANDO;
- it does not interrupt or become a command by default;
- an explicit "Lumi ..." wake address or interrupt phrase remains valid;
- a bare "Lumi" / "para" stops the answer and opens a bounded follow-up window;
- the diagnostics panel counts `householdIgnored` events.

This directly targets household speech from another adult, a child or ambient
television without pretending that speaker identification has already been
solved.
