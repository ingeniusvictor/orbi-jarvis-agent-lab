# C1-E — Local Voice Convergence Plan

## Why this is next

The Companion runtime is now stable enough to move beyond browser-dependent
speech recognition. Recent AMR testing showed the practical limitation clearly:
Chrome can transcribe technical model names such as Qwen inconsistently even
when the user speaks them correctly.

C1-E therefore becomes the next canonical improvement block.

## Legacy source reviewed

Reference repository:

`ingeniusvictor/orbi-chatbox-ia-core`

Reference branch:

`feature/0k-36-commercial-hardening`

Reusable voice components confirmed:

- `server/src/services/localSpeechToTextProvider.ts`
  - local command execution;
  - bounded audio size;
  - explicit supported formats;
  - timeout handling;
  - temporary-file isolation and cleanup;
  - language selection;
  - initial prompt support;
  - structured STT error codes.
- `server/src/services/kokoroTextToSpeechProvider.ts`
  - local Kokoro synthesis through the existing Python runtime;
  - WAV validation;
  - timeout handling;
  - Spanish-only guard.
- `server/src/services/createTextToSpeechProvider.ts`
  - Kokoro primary;
  - local SAPI fallback.
- `server/src/services/localTextToSpeechProvider.ts`
  - Windows SAPI fallback;
  - Microsoft Helena Desktop in the legacy profile;
  - PCM WAV validation.

## Target Companion voice chain

```text
Microphone
   ↓
existing Companion VAD / turn assembly
   ↓
Whisper.cpp local STT
   ↓
O.R.B.I.A. Core
   ↓
active local LLM through AMR
   ↓
Kokoro local TTS
   ↓
SAPI / browser fallback
   ↓
L.U.M.I.A. holographic output
```

## Migration rules

1. Do not remove the current browser speech path until local STT is certified.
2. Preserve long-utterance assembly already fixed in the Companion runtime.
3. Preserve barge-in and explicit interruption.
4. Preserve the current L.U.M.I.A. visual state machine.
5. Local voice failures must fall back cleanly instead of making the assistant mute.
6. No cloud speech dependency is required for the default local profile.
7. Audio files created for transcription/synthesis are temporary and cleaned up.
8. Voice capability detection must happen at boot and be visible in diagnostics.

## Planned implementation order

### C1-E1 — Local STT capability probe

- detect whether the Whisper.cpp executable exists;
- detect configured local model path;
- report readiness through the bridge;
- do not change the active voice path yet.

### C1-E2 — Local STT adapter

- port the bounded legacy LocalSpeechToTextProvider concepts;
- expose a bridge-local transcription route;
- retain current browser SpeechRecognition as fallback.

### C1-E3 — Companion integration

- route captured audio through local STT when available;
- keep current turn assembly;
- preserve wake/listen/guard behavior;
- compare latency and transcription quality against browser recognition.

### C1-E4 — Local TTS convergence

- Kokoro local primary where performance is acceptable;
- SAPI local fallback;
- browser TTS remains controlled fallback during transition.

### C1-E5 — Certification

Validate:

- short commands;
- long Spanish questions;
- technical names such as Qwen, O.R.B.I.A. and L.U.M.I.A.;
- barge-in;
- repeated turns;
- local model switching while voice remains active;
- fallback behavior when Whisper/Kokoro are unavailable.

## After C1-E

Return to Adaptive Model Runtime:

### AMR-02 — Device Capability Profile

- CPU;
- RAM;
- GPU;
- VRAM where available;
- installed Ollama models;
- model-size recommendations;
- per-device default profile.

This will allow the same L.U.M.I.A. build to recommend lighter models on modest
computers and larger models on machines with dedicated GPUs and more memory.
