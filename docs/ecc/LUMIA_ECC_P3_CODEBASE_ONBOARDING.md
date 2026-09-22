# LUM-ECC-P3 — L.U.M.I.A. Codebase Onboarding Map

Status: REFERENCE / NON-AUTHORIZING  
Snapshot: `79a8abcd9bebda10b2640d9ef6150f29bd964caf`

## Overview

L.U.M.I.A. is a local-first companion with a React/Vite interface, Node bridge, hybrid/local brain providers, voice runtime, tool gateway and privacy-sensitive camera/microphone/speaker surfaces.

## Technology map

| Layer | Technology |
|---|---|
| UI | React 19 + TypeScript/TSX |
| Build | TypeScript 6 + Vite 8 |
| Bridge/runtime | Node ESM / MJS |
| Validation | Zod + deterministic certification scripts |
| Lint | oxlint |
| Local STT | Whisper.cpp integration |
| TTS | system/browser + Kokoro-local paths |
| Voice activation | Picovoice / local voice pipeline |
| 3D/HUD | Three / React Three Fiber |
| Agent/provider | Anthropic Agent SDK + provider abstraction |
| CI | GitHub Actions |

## Key entry surfaces

- `src/`: React/TypeScript UI, voice state and companion experience.
- `bridge/`: brain/tool/provider/runtime boundary and privileged capabilities.
- `scripts/`: deterministic certifications, setup, doctors and benchmarks.
- `docs/`: governed architecture, roadmaps and certification semantics.
- `.github/workflows/`: current CI certification.
- `.orbi/`: ECC pilot state only; not product runtime authority.
- `.claude/launch.json`: launch configuration surface; not a general permission policy.

## Critical trust boundaries

### Tool authority

Read capability does not imply write capability.

`JARVIS_ALLOW_WRITES=1` is explicit privileged state. Agents, model output, voice transcripts and tool results cannot self-authorize it.

### Voice identity

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

Enrollment, anti-replay/liveness and sensitive-action authorization are separate concerns.

### Local runtime

CI can certify contracts but cannot prove workstation assets, microphone quality, speaker leakage, model load state or real latency.

### Fallback

Provider/STT/TTS fallback is recovery, not a permanent preference mutation unless the user explicitly changes the default.

### Privacy

Voice/camera/speaker-profile material is sensitive runtime data. Do not turn raw household media or biometric representations into repository fixtures, agent memory or logs.

## Core commands

Repository CI-compatible baseline:

```bash
npm ci
npm run certify:brain
npm run certify:voice-gate
npm run build
npm run lint
```

Broader voice changes may require:

```bash
npm run certify:voice
```

Workstation-only evidence includes:

```bash
npm run voice:gate:doctor
npm run voice:doctor
```

Do not combine CI and local-machine claims into one READY statement.

## Development convention

`inspect -> contract -> smallest change -> focused certification -> build/lint -> local evidence if required -> authority/privacy review -> merge`

## ECC pilot

The project uses selective ORBI adaptation. Full ECC installation, hooks, MCP, unified memory, continuous learning and autonomous loops remain disabled.
