# ORBI JARVIS Agent Lab — Phase 0 Baseline

## Purpose

This repository is an ORBI research laboratory based on the public MIT-licensed project `adewaskar/jarvis`.

The laboratory exists to study, validate, adapt and selectively extract useful capabilities before any integration into LUMI.

**Rule:** LUMI is not modified from this repository until a capability has been tested and validated here.

## Upstream baseline

- Upstream: `adewaskar/jarvis`
- Upstream baseline commit: `1c4016afdf86f7043efc6882ceffef84ad0d8783`
- Local ORBI mirror baseline: identical source snapshot on `main`
- License: MIT
- Upstream remote should remain configured as `upstream`
- ORBI repository remote should remain configured as `origin`

The original `LICENSE` file must remain preserved. Audio assets require separate rights review before any commercial release.

## Phase 0 objective

Reverse-engineer the system without changing its behavior, then classify every important subsystem using:

- **KEEP** — useful largely as-is
- **ADAPT** — useful but must be changed for ORBI/LUMI
- **REPLACE** — tightly coupled to Claude or otherwise unsuitable
- **EXTEND** — keep and add ORBI capabilities

## Initial subsystem map

| Area | Key files / packages | Initial decision | Notes |
|---|---|---|---|
| Holographic reactor / scene | `src/scene/*`, Three.js, R3F | KEEP + ADAPT | Candidate visual shell around future LUMI avatar |
| HUD / panels / effects | `src/ui/*` | KEEP + ADAPT | Strong base for visible agent state and tool feedback |
| Audio-reactive behavior | `src/lib/audio.ts`, scene/UI | KEEP + EXTEND | Later drive visuals from real LUMI TTS audio |
| Wake word | Picovoice Porcupine | ADAPT | Replace "Hey Jarvis" with ORBI/LUMI wake strategy |
| Voice activity / barge-in | `src/lib/vad.ts`, `src/lib/voice.ts` | KEEP + ADAPT | Important for natural interruption |
| TTS | browser speech + ElevenLabs + `kokoro-js` | KEEP + ADAPT | Kokoro is strategically aligned with LUMI |
| STT | browser / ElevenLabs | REPLACE or EXTEND | Target local Whisper.cpp path |
| Brain selector | `src/lib/brain.ts` | ADAPT | Natural insertion point for ORBI provider router |
| Claude direct client | `src/lib/anthropic.ts` | KEEP as optional provider | Must not remain mandatory |
| Bridge | `src/lib/bridge.ts`, `bridge/server.mjs` | KEEP + MAJOR ADAPT | Core transport, streaming, tools, MCP, permissions |
| Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` | REPLACE as default | Keep Claude only as optional cloud provider |
| Agent/tool loop | `bridge/server.mjs` | ADAPT | Preserve streaming/tool events while decoupling provider |
| Permission gate | `decideTool()` in bridge | KEEP + HARDEN | Default-deny effectful actions |
| MCP integration | bridge MCP servers | KEEP + EXTEND | Important for browser, system and future ORBI tools |
| Chrome control | `bridge/chrome.mjs` | KEEP + AUDIT | Candidate for computer/browser actions |
| Camera / vision | `src/lib/camera.ts`, `bridge/vision.mjs` | KEEP + AUDIT | Useful multimodal capability |
| Hand gestures | `src/lib/hands.ts`, MediaPipe | OPTIONAL KEEP | Nice UI capability, not required for first local-AI milestone |
| ORBI Core | external ORBI architecture | EXTEND | Integrate only after local provider boundary is stable |
| ORBI Edge Mesh | external ORBI architecture | FUTURE EXTEND | Route inference/tools across nodes later |
| LUMI avatar | external LUMI asset | FUTURE EXTEND | Place at reactor center after UI architecture is stable |

## Target architecture

```text
Browser / Holographic UI
        |
Voice + Wake + VAD
        |
     ORBI Brain Router
        |
   +----+-------------------+
   |                        |
LOCAL DEFAULT           OPTIONAL CLOUD
Ollama / Qwen           Claude / Codex / Gemini
   |
Agent Orchestrator
   |
MCP / Browser / PC / Git / Android / ORBI tools
   |
Result
   |
Kokoro / local TTS
   |
Audio-reactive LUMI UI
```

## Safety principles

1. Read-only by default.
2. Effectful actions require an explicit enabled policy.
3. Local providers must not bypass the permission layer.
4. Tool execution and model reasoning remain separate concerns.
5. No secret/API key may be committed.
6. No destructive experimentation on LUMI or production ORBI repositories.
7. Preserve provenance and MIT notices from upstream.

## Phase 0 exit criteria

Phase 0 is complete when:

- The upstream mirror is certified.
- The original project builds successfully without ORBI changes.
- Major modules are classified KEEP / ADAPT / REPLACE / EXTEND.
- Claude-specific coupling points are documented.
- The provider boundary for a local model is identified.
- Security and permission behavior is documented.
- A Phase 1 plan exists for Ollama/Qwen integration.


## Phase 0A certification — local environment

Validated on the ORBI development laptop without modifying JARVIS behavior.

- Node.js: `v26.7.0`
- npm: `11.19.0`
- `npm ci`: PASS — 260 packages installed
- `npm run lint`: PASS — 0 errors, 2 upstream warnings
- `npm run build`: PASS — Vite production build completed
- Modules transformed: 615
- Preflight: Node ready; Claude CLI absent; no local Claude MCP config; no ElevenLabs key
- Current local testing policy: do not install Claude or ElevenLabs merely to satisfy the upstream default path
- Security note: npm reported 8 dependency vulnerabilities (3 moderate, 5 high); no automatic audit fix applied during baseline certification
- Supply-chain note: npm reported install scripts for esbuild, onnxruntime-node, protobufjs and sharp as not yet approved under the local npm policy; no blind approvals performed
- Build warnings about browser externalization of `node:fs` / `node:path` originate from the Anthropic SDK direct-browser dependency path and did not fail the build
- Large production chunks are expected from Kokoro / ONNX / Three.js and are optimization work, not a Phase 0 blocker

### Phase 0A result

**PASS.** The upstream codebase installs, lints and builds successfully on the current ORBI workstation.

The next certification step is **Phase 0B — runtime visual/voice baseline**, starting the original application in read-only mode and validating the holographic UI, microphone path, wake/listening behavior, diagnostics and available camera/gesture features before any local-AI refactor.

## Phase 1 proposed first milestone

**Goal:** run the JARVIS interface and conversation loop with a local Ollama/Qwen provider instead of Claude, without yet integrating LUMI.

Success means:

1. UI boots normally.
2. User can speak or submit a prompt.
3. Prompt is sent to a local Ollama model.
4. Response streams back through the existing bridge contract.
5. Existing TTS speaks the answer.
6. No Anthropic login or API key is required for this local path.
7. Claude remains available only as an optional provider.
