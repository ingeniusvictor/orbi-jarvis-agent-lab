# LUM-ECC-P1 — L.U.M.I.A. ECC Inventory and Instruction Baseline

Status: CONTROLLED / NO PRODUCT-RUNTIME CHANGE

Base branch: `feature/lumia-voice-gate-v1`  
Audited/verified baseline: `3aab2ed1f1663bf0ee9da27736fd231f42068818`

## Purpose

Apply the ORBI ECC portable core to L.U.M.I.A. without copying the Creative Studio profile verbatim.

P1 introduces only:

- repository-owned root agent instructions;
- a L.U.M.I.A.-specific ECC candidate manifest;
- a PR CI gate for the active Voice Gate development line.

No voice, provider, model, UI, bridge or runtime source is changed.

## Why L.U.M.I.A. is a distinct adaptation

L.U.M.I.A. has trust boundaries that Creative Studio does not:

- always-on/interactive microphone behavior;
- camera capability;
- local STT/TTS runtimes;
- wake-word detection;
- household focus;
- diarization;
- speaker enrollment/verification;
- biometric/privacy considerations;
- read-only vs privileged tool execution;
- provider routing and secure secrets;
- local machine runtime state that GitHub CI cannot certify.

The ECC layer must reflect those boundaries instead of importing generic assumptions.

## Existing verified baseline

The existing `LUMIA Voice Gate Certification` completed successfully on baseline
`3aab2ed1f1663bf0ee9da27736fd231f42068818`.

That proves the deterministic Voice Gate contract/build/lint surface represented by that workflow.

It does **not** prove:

- a workstation has an enrolled speaker profile;
- anti-replay/liveness is available;
- local Whisper/Kokoro/diarization assets are installed;
- microphone/speaker quality or latency;
- a voice similarity result is sufficient authorization.

## P1 authority model

P1 codifies:

`ENGINE READY != USER ENROLLED != ANTI-REPLAY READY != VOICE GATE FULLY READY`

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`CONTRACT PASS != REAL AUDIO QUALITY/LATENCY CERTIFIED`

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

It also preserves the existing explicit write mode: read-only behavior is not permission to enable `JARVIS_ALLOW_WRITES=1`.

## New PR gate

The existing Voice Gate workflow is strong for branch pushes, but its pull-request target is the brain-provider branch rather than the Voice Gate branch.

P1 therefore adds `.github/workflows/lumia-ecc-pr-gate.yml` targeting pull requests into
`feature/lumia-voice-gate-v1`.

The gate is read-only and uses immutable action SHAs.

It verifies:

- exact dependency install;
- brain/provider contracts;
- voice-gate/speaker-verification contracts;
- production build;
- lint.

Workstation-specific doctors remain separate evidence.

## ECC state

P1 does not install ECC.

Disabled:

- full ECC install;
- bulk agent/skill copying;
- hooks;
- MCP;
- continuous-learning-v2;
- unified-memory runtime;
- autonomous loops;
- multi-agent roles.

## Next phase

LUM-ECC-P2 should add a fresh, repository-specific AgentShield report-only baseline.

Any accepted scanner finding must be justified from L.U.M.I.A. evidence. The Creative Studio lockfile false-positive baseline is not inherited automatically.
