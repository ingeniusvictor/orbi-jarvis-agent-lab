# VRM-01 — O.R.B.I.A. Voice Runtime Manager

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

## Planned implementation

### VRM-01A — contracts and registry

- provider-neutral STT mode;
- provider-neutral TTS mode;
- VoiceProfile registry;
- current active selection;
- runtime status.

### VRM-01B — spoken controls

- list available STT/TTS modes;
- switch STT mode;
- switch TTS mode;
- list voice profiles;
- switch voice profile.

### VRM-01C — C1-E integration

- Whisper.cpp becomes a selectable STT provider;
- Kokoro becomes a selectable TTS provider;
- existing browser/system path remains available.

### VRM-01D — custom voice providers

- add custom/local cloned-voice adapter when a certified engine is chosen;
- keep owner/consent metadata in the profile;
- expose only installed/authorized profiles.

## Non-negotiable rule

Changing the speech engine or voice profile never changes L.U.M.I.A.'s identity,
memory, knowledge, tools or permissions. It only changes how she hears and/or
sounds.
