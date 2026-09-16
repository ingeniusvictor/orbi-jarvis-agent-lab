# VRM-01 — O.R.B.I.A. Voice Runtime Manager

## Status

**VRM-01A/B/C IMPLEMENTED — LOCAL WORKSTATION CERTIFICATION PENDING**

Implemented on the convergence branch:

- provider-neutral STT/TTS runtime state;
- browser/local/auto voice modes;
- independent STT and TTS selection;
- Voice Profile Registry with owner/consent metadata;
- deterministic spoken voice controls intercepted before the local LLM;
- live WebSocket runtime updates without page reload;
- selectable local Whisper STT path with browser fallback;
- selectable local Kokoro TTS path with system fallback;
- local runtime readiness exposed through bridge health and diagnostics;
- `npm run voice:doctor` for installed-runtime inspection.

The local Whisper/Kokoro binaries and weights remain machine-local under
`.local-runtime/` and are not committed. End-to-end audio quality/latency is
therefore not certified until the workstation runtime is installed and tested.

## Goal

L.U.M.I.A. must not be tied to one speech engine or one speaking voice.

Voice input (STT) and voice output (TTS) are separate runtime choices and can be
selected independently per device.

## Canonical voice architecture

```text
Microphone
   ↓
STT Router
   ├── browser-speech
   ├── whisper-local
   └── future providers
   ↓
O.R.B.I.A. Core
   ↓
active LLM / AMR
   ↓
TTS Router
   ├── system-browser
   ├── kokoro-local
   ├── custom-local-voice
   └── future providers
   ↓
L.U.M.I.A. audio output
```

## Runtime modes

### Browser mode

- STT: browser SpeechRecognition
- TTS: system/browser speech synthesis
- lowest setup cost
- good fallback path

### Local mode

- STT: Whisper.cpp local
- TTS: Kokoro local when available
- SAPI/system fallback
- intended default for privacy/offline use after C1-E certification

### Auto mode

O.R.B.I.A. selects the best available stack for the current device while
preserving explicit user overrides.

## Independent controls

The user may change STT and TTS separately.

Examples:

- "Lumi, usa reconocimiento local."
- "Lumi, vuelve al reconocimiento del navegador."
- "Lumi, usa voz local."
- "Lumi, usa la voz del sistema."
- "Lumi, activa modo de voz automático."

A user may therefore run Whisper locally while keeping the fast system voice, or
use browser STT while testing a local neural voice.

## Voice Profile Registry

TTS voice identity must be represented as a profile rather than hard-coded into
the assistant.

Suggested contract:

```text
VoiceProfile
  id
  displayName
  provider
  language
  locale
  modelRef
  speakerRef
  owner
  consentConfirmed
  deviceScope
  enabled
```

Examples:

- lumia-default
- lumia-system
- custom-user-voice
- custom-family-voice

Custom voice profiles must be added only from voice material supplied or
authorized by the voice owner.

## Future custom / cloned voices

The runtime should allow a later local voice-cloning provider without changing
O.R.B.I.A. Core.

Possible future path:

```text
authorized voice samples
   ↓
voice-profile preparation
   ↓
local custom voice model / speaker embedding
   ↓
Voice Profile Registry
   ↓
TTS Router
   ↓
"Lumi, usa la voz <perfil>"
```

The provider contract must not assume Kokoro specifically, because Kokoro is a
TTS engine and is not the only possible future engine for speaker cloning.

## Fallback policy

```text
STT
whisper-local
   ↓ unavailable/failure
browser-speech

TTS
selected custom/local voice
   ↓ unavailable/failure
kokoro-local
   ↓ unavailable/failure
system/SAPI
   ↓ unavailable/failure
browser TTS
```

Fallback must not silently change the selected profile permanently. It is a
per-turn recovery unless the user explicitly changes the default.

## Device persistence

Later VRM phases should persist preferences per device:

```text
Victor-Lenovo
  sttMode = local
  ttsMode = system
  voiceProfile = lumia-default

Other-PC
  sttMode = browser
  ttsMode = system
  voiceProfile = lumia-system
```

## Implementation blocks

### VRM-01A — contracts and registry — IMPLEMENTED

- provider-neutral STT mode;
- provider-neutral TTS mode;
- VoiceProfile registry;
- current active selection;
- runtime status.

### VRM-01B — spoken controls — IMPLEMENTED

- list available STT/TTS modes;
- switch STT mode;
- switch TTS mode;
- list voice profiles;
- switch voice profile.

### VRM-01C — C1-E integration — IMPLEMENTED, CERTIFICATION PENDING

- Whisper.cpp becomes a selectable STT provider;
- Kokoro becomes a selectable TTS provider;
- existing browser/system path remains available.

### VRM-01D — custom voice providers — DEFERRED

- add custom/local cloned-voice adapter when a certified engine is chosen;
- keep owner/consent metadata in the profile;
- expose only installed/authorized profiles.

## Non-negotiable rule

Changing the speech engine or voice profile never changes L.U.M.I.A.'s identity,
memory, knowledge, tools or permissions. It only changes how she hears and/or
sounds.

## Certification commands

```bash
npm run certify:voice
npm run lint
npm run build
npm run voice:doctor
```

The certification scripts verify contracts and fallback routing. A PASS does not
by itself certify real Whisper/Kokoro audio; that requires the local runtime
assets and a manual Companion voice test.
