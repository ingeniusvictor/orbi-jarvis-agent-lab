# C1-E — Local Voice Convergence Plan

## Status

**C1-E1 THROUGH C1-E4 IMPLEMENTED — C1-E5 LOCAL AUDIO CERTIFICATION PENDING**

Current implementation includes:

- local Whisper/Kokoro asset probe;
- bounded Whisper.cpp adapter and `/stt/local` bridge route;
- browser-side conversion of captured segments to mono 16 kHz PCM WAV;
- reuse of the existing VAD, long-utterance assembler and barge-in path;
- bounded Kokoro adapter and `/tts/local` bridge route;
- runtime browser/local switching through VRM;
- technical STT vocabulary hints including Qwen, Ollama, O.R.B.I.A. and L.U.M.I.A.;
- deterministic fallback to browser/system voice when local runtimes are absent;
- runtime diagnostics and `npm run voice:doctor`.

No claim is made yet that Whisper/Kokoro audio is working on the user's current
machine. The binaries, Python environment and model weights are intentionally
local-only and must be installed/verified before C1-E5 can be closed.

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

### C1-E1 — Local STT capability probe — IMPLEMENTED

- detect whether the Whisper.cpp executable exists;
- detect configured local model path;
- report readiness through the bridge;
- do not change the active voice path yet.

### C1-E2 — Local STT adapter — IMPLEMENTED

- port the bounded legacy LocalSpeechToTextProvider concepts;
- expose a bridge-local transcription route;
- retain current browser SpeechRecognition as fallback.

### C1-E3 — Companion integration — IMPLEMENTED

- route captured audio through local STT when available;
- keep current turn assembly;
- preserve wake/listen/guard behavior;
- compare latency and transcription quality against browser recognition.

### C1-E4 — Local TTS convergence — IMPLEMENTED

- Kokoro local primary where performance is acceptable;
- SAPI local fallback;
- browser TTS remains controlled fallback during transition.

### C1-E5 — Certification — PENDING

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

## Current certification gate

Run on the target workstation:

```bash
npm run certify:voice
npm run lint
npm run build
npm run voice:doctor
```

After local runtimes are ready, manually validate browser mode, local mode,
independent STT/TTS switching, long Spanish dictation, Qwen/Ollama terminology,
barge-in, repeated turns and fallback behaviour.

## Workstation validation — 2026-09-15

Confirmed on the target Windows workstation:

- `npm run lint` — PASS, 0 warnings / 0 errors.
- `npm run build` — PASS.
- whisper.cpp Windows CPU runtime — READY.
- Whisper `ggml-base.bin` model — READY.
- `npm run voice:doctor` reports `Local STT: READY`.
- VRM `auto` currently resolves STT to `local`.
- TTS remains `system` because Kokoro is not installed yet.

Next certification gate: manual Companion STT validation with short Spanish commands,
long dictation, technical vocabulary (Qwen/Ollama/O.R.B.I.A./L.U.M.I.A.) and
barge-in before installing Kokoro.
