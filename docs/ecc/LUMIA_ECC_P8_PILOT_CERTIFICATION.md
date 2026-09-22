# LUM-ECC-P8 — L.U.M.I.A. Selective ECC Pilot Certification

Status: SELECTIVE ADOPTION READY  
Pilot repository: `ingeniusvictor/orbi-jarvis-agent-lab`  
Canonical development branch: `feature/lumia-voice-gate-v1`  
Certified baseline before P8: `9a79bf97f6c45c56f3521424a0bab517356c6c6a`

## Purpose

Close the L.U.M.I.A. ECC pilot with an evidence-backed reusable engineering profile.

This certification applies to the **engineering/agent-harness layer** around L.U.M.I.A. It does not claim that workstation audio, speaker enrollment, liveness, anti-replay, microphone, camera or local model assets are physically ready merely because CI is GREEN.

## Upstream references

- ECC: `2.2.2 @ 91ba9b4cf6c47c8130829004f8bb64762a76ccbb`
- AgentShield: `1.6.0 @ b0891303bdcd6037376a94263d45cfd2ff3dfb98`

## Pilot history

| Phase | PR | Result |
|---|---:|---|
| P1 | #1 | governed AGENTS/profile + Voice Gate PR CI |
| P2 | #2 | L.U.M.I.A.-specific AgentShield baseline |
| P3 | #3 | evidence-backed agent sort + onboarding |
| P4 | #4 | `orbi-lumia-verification-loop` |
| P5 | #5 | `orbi-lumia-security-review` |
| P6 | #6 | `orbi-lumia-agent-harness` + observation contract |
| P7 | #7 | `orbi-lumia-context-budget` + deterministic auditor |

Each phase was merged only after the applicable repository gates completed successfully.

## Materialized L.U.M.I.A. engineering layer

### Root instructions

`AGENTS.md`

Encodes:

- active Voice Gate branch discipline;
- CI vs workstation evidence separation;
- voice/identity/privacy boundaries;
- explicit write-mode boundaries;
- provider-secret rules;
- local runtime/model constraints;
- ECC selective-adoption limits.

### Project skills

- `orbi-lumia-verification-loop`
- `orbi-lumia-security-review`
- `orbi-lumia-agent-harness`
- `orbi-lumia-context-budget`

### Deterministic development tooling

- `.orbi/lumia-agent-observation-v1.schema.json`
- `scripts/validate-lumia-agent-observation.mjs`
- `scripts/certify-lumia-agent-harness.mjs`
- `scripts/ecc-lumia-context-budget.mjs`
- `scripts/certify-lumia-context-budget.mjs`

These are engineering/certification surfaces, not L.U.M.I.A. product-runtime dependencies.

## Final pre-certification evidence

P7 head: `4344aba2b078f0a9755dda87c760591f451701c2`

L.U.M.I.A. ECC Pull Request Gate run: `35678816953`

All steps PASS:

- exact dependency install;
- Brain provider contracts;
- Voice Gate contracts;
- ECC agent-harness contract;
- ECC context-budget contract;
- production build;
- lint.

AgentShield run: `35678817032`

Result:

- report-only workflow: SUCCESS;
- score: 80 / B;
- findings: 358;
- unique finding classes: 1;
- finding class: `Hardcoded Azure storage account key` in `package-lock.json`;
- classification remains the L.U.M.I.A. P2 baseline: npm `integrity: sha512-...` false positives;
- supply chain: CLEAN;
- evidence-pack verification: PASS;
- evidence-pack digest: `sha256:e1ffb8455ab586440f3a456485eac5a2b81227b7ec9fd905302f96bb1295f35b`;
- new non-lockfile finding classes: 0.

## Evidence boundaries certified

The selective ECC layer preserves:

`ENGINE READY != USER ENROLLED != ANTI-REPLAY READY != VOICE GATE FULLY READY`

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`SPEAKER MATCH != AUTHORIZATION FOR SENSITIVE ACTION`

`CONTRACT PASS != REAL AUDIO QUALITY/LATENCY CERTIFIED`

`CI CONTRACT PASS != WORKSTATION/HARDWARE READY`

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

`READ ACCESS != WRITE ACCESS`

`FALLBACK SUCCESS != PERMANENT PREFERENCE CHANGE`

These distinctions are part of the certification outcome, not optional wording.

## Voice / biometric privacy posture

The ECC layer has no authority to:

- silently enroll a speaker;
- persist raw household audio or biometric material;
- treat speaker similarity as sole proof of identity;
- treat speaker match as sufficient authorization for sensitive actions;
- bypass anti-replay/liveness;
- hide camera/microphone capture;
- promote a local voice/runtime capability from CI evidence alone.

Speaker verification and anti-replay remain distinct controls.

## Tool/write authority posture

The selective layer does not:

- enable `JARVIS_ALLOW_WRITES=1`;
- widen tool allowlists;
- convert model output into tool authorization;
- grant browser/filesystem/process writes;
- persist provider fallback as a preference change;
- disclose provider secrets;
- self-authorize external writes.

Any future privileged/write capability remains a separately governed product/security change.

## Context-budget result

P7 measured:

- always-instructions: 1;
- discoverable project skills: 4;
- config references: 2;
- estimated persistent repository instruction overhead: ~1,339 tokens;
- four discoverable skills if all were fully read: ~3,865 tokens;
- config references if fully read: ~1,139 tokens.

The important rule is the loading model:

**discoverable skills are not treated as permanent context merely because they exist.**

The `AGENTS.md` size flag is informational and must not be cleared by deleting safety/authority guidance.

## What is portable

### Portable with domain review

- explicit authority-impact observations;
- structured recovery and stop conditions;
- CI-vs-local-evidence separation;
- context-budget loading model;
- fail-closed tool/action-space design;
- evidence-backed completion model.

### L.U.M.I.A.-specific and must be adapted elsewhere

- voice/speaker identity rules;
- anti-replay/liveness separation;
- camera/microphone privacy;
- provider fallback semantics;
- local STT/TTS/runtime readiness;
- write/tool authority domains;
- AgentShield accepted baseline;
- Voice Gate certification commands.

## Deliberately disabled after P8

- full ECC installation;
- bulk agent/skill installation;
- hooks;
- MCP;
- continuous-learning-v2;
- unified-memory runtime;
- autonomous loops;
- multi-agent roles.

This is intentional. P8 does not authorize those as the automatic next phase.

## Current product evidence limitation

CI can certify contracts and builds. It does **not** establish workstation readiness for:

- enrolled speaker profile;
- DPAPI-protected local enrollment state;
- anti-replay/liveness provider;
- Whisper model/runtime presence;
- Kokoro model/runtime presence;
- microphone/speaker/camera hardware behavior;
- real-world latency/audio quality.

Those remain local/runtime evidence and should continue to be reported separately by the existing doctor/certification tools.

## Certification conclusion

L.U.M.I.A. demonstrates that ECC can be adapted to a local-first companion with sensitive voice, identity, tool and runtime boundaries without turning ECC into a runtime dependency.

Approved pattern:

`ECC reference -> ORBI adaptation -> L.U.M.I.A. evidence -> selective project skills -> deterministic contract -> CI/security validation -> canonical merge`

P8 certifies the current selective engineering layer as reusable for continued L.U.M.I.A. development while hooks, memory, autonomous loops and privileged authority remain disabled.
