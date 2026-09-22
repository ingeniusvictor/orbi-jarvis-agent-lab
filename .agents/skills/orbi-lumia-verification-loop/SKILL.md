---
name: orbi-lumia-verification-loop
description: Repository-aware verification workflow for L.U.M.I.A. Use after meaningful code/config changes and before claiming a branch, voice/runtime phase, or PR is ready. Separates CI contract evidence from workstation audio/hardware evidence and preserves voice/tool authority boundaries.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC verification-loop 2.2.2
  source_pattern: ORBI Creative Studio selective ECC pilot
  rollback_strategy: Remove this skill directory and its L.U.M.I.A. ECC profile registration. Product runtime does not depend on it.
---

# ORBI L.U.M.I.A. Verification Loop

Use this skill to decide whether a L.U.M.I.A. change is actually ready.

The current repository state, certification scripts, governed docs and root `AGENTS.md` are authoritative. This skill cannot grant tool/write authority, speaker identity, enrollment approval, provider-secret access or runtime readiness.

## Activate when

- a voice, provider, tool, bridge, UI or runtime feature is complete;
- a certification phase is about to be called READY;
- provider/fallback/tool behavior changes;
- speaker enrollment/verification or diarization changes;
- camera/microphone behavior changes;
- local STT/TTS/model runtime changes;
- a PR is about to be merged.

## 1. Establish exact state

Record:

- current branch and HEAD;
- current `feature/lumia-voice-gate-v1` HEAD;
- changed files/surfaces;
- relevant certification scripts/docs;
- whether local workstation evidence is required.

Do not reuse a prior GREEN result after the branch HEAD moves.

## 2. Classify the evidence lane

Identify which lanes apply:

- TypeScript/TSX;
- React/UI;
- bridge/tool runtime;
- brain/provider routing;
- provider secrets;
- voice/STT/TTS;
- diarization;
- speaker verification/enrollment;
- camera/microphone;
- local model/runtime;
- CI/agent configuration.

## 3. Focused certification first

Run the narrowest existing certification that covers the change.

Examples include:

```bash
npm run certify:brain-providers
npm run certify:hybrid-router
npm run certify:voice-gate
npm run certify:speaker-verification
npm run certify:voice-focus
npm run certify:diarization-adapter
npm run certify:multivoice-stt
```

Inspect `package.json` before choosing a command. Do not invent a certification script.

## 4. Repository PR baseline

The current CI-compatible baseline for the Voice Gate line is:

```bash
npm ci
npm run certify:brain
npm run certify:voice-gate
npm run build
npm run lint
```

For cross-cutting voice-pipeline work, also consider:

```bash
npm run certify:voice
```

Do not replace repository commands with generic ECC defaults.

## 5. Workstation-only evidence

Commands such as:

```bash
npm run voice:gate:doctor
npm run voice:doctor
```

produce machine-local evidence.

Treat them separately from CI because CI cannot prove:

- a speaker profile is enrolled;
- anti-replay/liveness samples exist;
- Whisper/Kokoro/diarization models are installed;
- microphone/speaker routing works;
- real-time latency/quality is acceptable;
- local model weights are loaded on the target workstation.

A CI PASS cannot upgrade local readiness.

## 6. Required semantic separations

Never collapse:

`ENGINE READY != USER ENROLLED != ANTI-REPLAY READY != VOICE GATE FULLY READY`

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`CONTRACT PASS != REAL AUDIO QUALITY/LATENCY CERTIFIED`

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

`FALLBACK SUCCESS != PERMANENT PREFERENCE CHANGE`

## 7. Security / privacy / authority check

Before READY, confirm whether the change affects:

- `JARVIS_ALLOW_WRITES` or other privileged tool behavior;
- provider secret storage/transport;
- browser/file/process capabilities;
- microphone/camera lifecycle;
- speaker/biometric profile material;
- provider preference persistence;
- local model/runtime download or execution;
- agent configuration, memory or MCP surfaces.

If one is affected, add the matching security/architecture review and cite evidence.

## 8. AgentShield baseline

AgentShield remains report-only.

Accepted baseline class at P2:

- detector: Hardcoded Azure storage account key;
- path: `package-lock.json`;
- disposition: false positive only when the evidence is demonstrably npm `integrity: sha512-...` metadata.

Any finding outside that exact class/path/evidence requires fresh review.

Do not rewrite lockfile integrity hashes to silence the scanner.

## 9. Final diff review

Confirm:

- no unrelated files changed;
- no secret/raw voice/biometric material entered Git;
- no certification was weakened simply to obtain GREEN;
- no fallback silently becomes a saved preference;
- no tool/read path silently becomes write authority;
- all evidence points to the final HEAD;
- pending/cancelled checks are not reported as passed.

## 10. Result

Return:

```text
LUMIA VERIFICATION REPORT

Scope:
- branch/head:
- voice-gate canonical head:
- changed surfaces:

Focused certifications:
- <command>: PASS / FAIL / NOT RUN

Repository gate:
- install:
- brain:
- voice gate:
- build:
- lint:

Workstation evidence:
- voice gate doctor:
- voice doctor:
- other:

Security/privacy/authority:
- new finding classes:
- write/tool impact:
- secret impact:
- voice/biometric impact:
- local-runtime impact:

Overall:
- READY / NOT READY / PARTIALLY VERIFIED

Remaining limitations:
- ...
```

Use READY only when all evidence required for the actual change has completed successfully.

## Rollback

This skill is instruction-only. Removing it and its manifest entry must not alter L.U.M.I.A. runtime behavior.
