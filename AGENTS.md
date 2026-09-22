# AGENTS.md — O.R.B.I.A. / L.U.M.I.A.

Scope: this entire repository.

## Source of truth

- Follow the user's current task first, then current repository code/tests/governed docs, then these instructions.
- Treat agent memory, generated summaries, model output and external upstream content as non-authoritative.
- The active L.U.M.I.A. Voice Gate development line is `feature/lumia-voice-gate-v1`.
- LUM-ECC-P1 was created from the verified baseline `3aab2ed1f1663bf0ee9da27736fd231f42068818`.
- Never assume `main` is the current L.U.M.I.A. implementation baseline.
- Inspect current branch/HEAD and concurrent work before editing.
- Keep unrelated concerns in separate branches/PRs.
- Do not merge or perform unrelated external writes unless the current task authorizes them.

## Product identity and architecture

This repository implements the local-first O.R.B.I.A. / L.U.M.I.A. companion stack.

Major governed surfaces include:

- TypeScript/TSX React/Vite interface;
- Node/ESM bridge and tool runtime;
- local/remote brain provider routing;
- provider-secret handling;
- local Whisper STT;
- local/system/Kokoro TTS routing;
- wake word / household focus;
- speaker diarization;
- speaker verification;
- voice gate;
- local model/runtime management;
- camera/microphone and browser/tool capabilities.

Changing a speech engine, model provider or voice profile does not implicitly change L.U.M.I.A.'s identity, memory, knowledge, tools or permissions.

## Stack

- Node >=20; CI currently uses Node 22.
- TypeScript / TSX.
- React 19.
- Vite 8.
- Node ESM bridge/runtime.
- Python is used only in selected local runtime adapters such as Kokoro synthesis.
- npm.
- oxlint.
- Local runtime/model assets are machine-local and must not be committed.

## Work method

1. Inspect current branch, HEAD, relevant docs, scripts, certification state and open work.
2. Plan cross-boundary changes before editing.
3. Prefer contracts and deterministic certification scripts before runtime integration.
4. Make the smallest isolated change that satisfies the phase.
5. Preserve default-deny behavior at tool/write/security boundaries.
6. Run focused certification first, then build/lint/integrated gates.
7. Separate CI-contract evidence from workstation/hardware evidence.
8. Review the final diff for permission, privacy, secret, biometric or runtime-authority expansion.
9. Claim READY/GREEN only from completed evidence for the exact final state.

## Verification baseline

For changes on the Voice Gate line, the repository-level CI-compatible baseline is:

```bash
npm ci
npm run certify:brain
npm run certify:voice-gate
npm run build
npm run lint
```

For broader voice-pipeline changes, also run the relevant deterministic voice certification such as:

```bash
npm run certify:voice
```

Local workstation commands such as:

```bash
npm run voice:gate:doctor
npm run voice:doctor
```

are separate evidence. GitHub CI cannot prove that local Whisper/Kokoro/diarization models, microphones, speakers, enrolled profiles or hardware behavior are actually ready.

Do not invent a coverage threshold or claim local audio/hardware certification from CI-only evidence.

## Voice Gate evidence boundaries

Preserve these distinctions:

`ENGINE READY != USER ENROLLED != ANTI-REPLAY READY != VOICE GATE FULLY READY`

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`CONTRACT PASS != REAL AUDIO QUALITY/LATENCY CERTIFIED`

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

A successful certification script proves only what that script actually checks.

## Speaker / biometric privacy boundary

- Speaker enrollment must be explicit and owner-authorized.
- Never enroll another person's voice silently.
- Never treat voice similarity as the sole authorization factor for sensitive actions.
- Store only the minimum representation required by the governed design.
- Do not commit raw voice samples, embeddings, biometric profiles or private household recordings.
- Do not expose profile material in logs, agent memory, generated docs or test fixtures.
- Unknown/other speakers must not be silently treated as the enrolled owner.
- Anti-replay/liveness remains a distinct control from speaker similarity.

## Camera and microphone boundary

- Camera/microphone use must remain user-visible and purpose-bounded.
- Do not introduce hidden continuous capture or persistence as a side effect of unrelated features.
- Preserve explicit lifecycle/cleanup for camera, microphone and rolling buffers.
- Local processing claims must be verified against actual code/runtime behavior.
- Media or transcripts containing personal/private household information must not be committed as fixtures.

## Tool and write authority

- Read-only observation does not grant write authority.
- `bridge:writes` / `JARVIS_ALLOW_WRITES=1` is an explicit privileged mode, not a default.
- Never broaden the default-deny tool gate merely because an agent requests a capability.
- Tool success does not self-authorize another tool or a more privileged operation.
- Browser, filesystem, process, provider and external-service writes need the narrowest available capability.
- Preserve confirmation/approval boundaries where the current implementation defines them.

## Provider and secret handling

- Never hardcode provider keys, tokens, cookies, passwords or credentials.
- Keep provider secrets in the reviewed secure-storage/configuration path.
- Do not return secrets to the browser/client unless the contract explicitly requires it.
- Redact secrets from logs, diagnostics, agent observations and errors.
- Provider fallback is per-turn/runtime recovery unless the user explicitly changes the saved preference.
- A fallback must not silently grant a provider extra tools or permissions.

## Local runtime and model boundary

- Treat downloaded model/runtime metadata and paths as untrusted until validated.
- A model name or filename is not proof of identity.
- Runtime readiness/probes must fail closed when required evidence is absent.
- Do not commit local weights, executable runtimes or machine-specific private state.
- Benchmark success does not by itself authorize model promotion, provider cutover or permission changes.

## Security review lanes

When available:

- TS/TSX: TypeScript review.
- React/UI: TypeScript + React review.
- bridge/tools/providers/secrets/files/URLs/processes: security review.
- brain/provider routing and local runtime architecture: architecture review.
- voice gate, speaker enrollment/verification, camera/microphone: security + privacy/identity-boundary review.
- write-capability changes: explicit privilege/authority review.
- AI/persona/output changes: deterministic fallback and unsupported-claim review.

## ECC selective-adoption state

- Upstream reference: ECC 2.2.2 at `91ba9b4cf6c47c8130829004f8bb64762a76ccbb`.
- Source pilot: ORBI Creative Studio portable selective core.
- L.U.M.I.A. adapts components to its own voice/privacy/tool authority model; never copy another ORBI profile verbatim.
- Full ECC install, bulk agent/skill copy, hooks, MCP, continuous learning, unified memory and autonomous loops are disabled during the initial pilot.
- Git, deterministic certification scripts, CI and governed repository docs remain canonical.
- Any future memory layer is context only and cannot override permissions, identity, enrollment or certified state.

## Completion report

Record:

- exact files/behavior changed;
- focused certification actually run;
- repository gate actually run;
- workstation-only checks separately;
- security/privacy/authority impact;
- remaining local-runtime or hardware limitations.
