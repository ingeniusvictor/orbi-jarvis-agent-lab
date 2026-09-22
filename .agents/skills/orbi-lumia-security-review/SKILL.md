---
name: orbi-lumia-security-review
description: Repository-aware security and privacy review workflow for L.U.M.I.A. Use when changing provider secrets, tool/write authority, browser/network/SSRF, camera/microphone, speaker enrollment/verification, local runtimes/processes, model downloads, or agent configuration.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC security-review 2.2.2
  source_pattern: ORBI selective ECC pilot
  rollback_strategy: Remove this skill directory and its L.U.M.I.A. ECC profile registration. Product runtime does not depend on it.
---

# ORBI L.U.M.I.A. Security Review

Use this skill for changes crossing a L.U.M.I.A. trust, privacy or authority boundary.

Repository code, certification scripts, governed docs and root `AGENTS.md` remain authoritative. This skill grants no write, secret, speaker-identity or deployment authority.

## Activate when

Use this skill when a change touches:

- `bridge/providers/secure-secrets.mjs` or provider credentials;
- `bridge/orbia/tool-engine.mjs`, write-capable tools or `JARVIS_ALLOW_WRITES`;
- `bridge/net.mjs`, browser/page/media proxying, redirects, URLs or DNS;
- camera or microphone lifecycle;
- voice recordings, diarization, speaker enrollment or verification;
- local subprocess execution, PowerShell, Python, Whisper, Kokoro or sherpa-onnx;
- local model/runtime downloads or filesystem paths;
- provider fallback/persistence;
- agent instructions, skills, hooks, MCP, memory or autonomous-loop configuration;
- dependency manifests, lockfiles or GitHub Actions.

## 1. Classify the trust boundary

For each changed surface identify:

- untrusted input source;
- trusted component receiving it;
- validation/sanitization;
- capability gained;
- persistence behavior;
- failure mode;
- deterministic evidence;
- whether human approval/consent is required.

Prefer fail-closed behavior where uncertainty could expose secrets, invoke tools, persist biometrics, reach private networks or execute a local process.

## 2. Tool and write authority

The current tool engine uses explicit registry + allowlist semantics.

Verify:

- unknown tools remain denied;
- tools are not executable solely because a model names them;
- validation runs before execution;
- timeouts and output bounds remain in place;
- read-only capability does not imply write capability;
- `JARVIS_ALLOW_WRITES=1` or equivalent privileged state is not silently enabled;
- a successful tool call cannot self-authorize a later privileged tool;
- catch-all tools do not combine read, write and process authority unnecessarily.

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

## 3. Provider secrets

Current OpenAI secret handling supports environment input and Windows DPAPI local storage.

Verify:

- no API key/token/password enters Git;
- secrets are not copied into docs, agent memory, skills, observations or logs;
- renderer/browser code does not receive raw secrets unnecessarily;
- errors do not echo secret plaintext;
- DPAPI ciphertext remains under ignored local-runtime paths;
- subprocess arguments do not expose secrets on command lines when avoidable;
- fallback to another provider does not persist a new preference unless explicitly requested.

## 4. Network / SSRF boundary

`bridge/net.mjs` is a central security boundary.

Preserve:

- absolute HTTP(S)-only targets;
- blocked localhost/private/link-local/metadata ranges;
- DNS resolution checks;
- DNS-rebinding resistance;
- redirect revalidation on every hop;
- timeout/body-size limits;
- no browser cookies or local credentials forwarded upstream;
- no duplicate proxy implementation that bypasses the common gate.

Review changes to `chrome.mjs`, `page.mjs`, media proxying or URL probes for a path around `net.mjs`.

## 5. Camera and microphone privacy

Verify:

- capture is user-visible and purpose-bounded;
- camera/mic lifecycle has deterministic cleanup;
- tracks are stopped when no longer needed;
- rolling buffers have bounded retention;
- temporary frames/audio are not silently persisted;
- private household media is not committed as fixtures;
- diagnostic logging does not retain raw media/transcripts unnecessarily;
- an unrelated feature does not start continuous capture as a side effect.

For `src/lib/camera.ts`, preserve the invariant that buffered frames are memory-only and cleared when the camera closes unless a later governed design explicitly changes it.

## 6. Speaker verification / biometric material

Current VG-02 stores a normalized speaker embedding locally and encrypts the profile with Windows DPAPI; raw enrollment audio is not persisted.

Verify:

- enrollment is explicit and voice-owner authorized;
- raw enrollment audio is not written to disk;
- embeddings/profile data do not enter Git/logs/agent memory;
- profile encryption/storage paths remain local and ignored;
- thresholds are not treated as universal identity proof;
- unknown/other speakers are not silently promoted to primary-user;
- sample-quality checks remain bounded;
- anti-replay/liveness remains separate.

Never collapse:

`DIARIZATION != SPEAKER AUTHENTICATION`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`SPEAKER MATCH != AUTHORIZATION FOR SENSITIVE ACTION`

`ENROLLED PROFILE != ANTI-REPLAY READY`

## 7. Local subprocess / runtime review

When changing PowerShell, Python, Whisper, Kokoro, sherpa-onnx or other local runtimes verify:

- executable identity/path is controlled;
- untrusted input is not shell-concatenated;
- arguments are structured;
- timeouts are bounded;
- stdout/stderr do not leak secrets or private voice data;
- runtime/model presence is validated before use;
- a filename/model ID is not treated as proof of provenance;
- failure remains observable and does not silently switch to a more privileged path.

## 8. Agentic configuration

For ECC/agent changes verify:

- root instructions do not weaken product security rules;
- project skills remain instruction-only unless explicitly designed otherwise;
- hooks remain disabled unless separately reviewed;
- MCP servers remain disabled unless separately reviewed;
- memory remains non-authoritative;
- continuous learning cannot modify permissions or security policy;
- autonomous loops cannot acquire tool/write authority implicitly.

## 9. AgentShield interpretation

AgentShield is report-only.

Accepted P2 false-positive baseline:

- detector: `Hardcoded Azure storage account key`;
- file: `package-lock.json`;
- evidence: npm `integrity: sha512-...` metadata only.

Any different path, detector, content class or secret-like evidence requires fresh review.

Do not rewrite lockfile integrity metadata to improve a scanner score.

## 10. Security report

Return:

```text
LUMIA SECURITY REVIEW

Scope:
- branch/head:
- changed files:
- trust boundaries:

Findings:
- CRITICAL:
- HIGH:
- MEDIUM:
- LOW:
- ACCEPTED BASELINE / FALSE POSITIVES:

Checks:
- tool/write authority:
- provider secrets:
- network/SSRF:
- camera/microphone:
- speaker/biometric:
- local runtime/process:
- agentic configuration:

Evidence:
- focused certifications:
- AgentShield run/artifact:
- integrated gate:
- workstation evidence if required:

Result:
- SECURITY READY / NOT READY / PARTIALLY VERIFIED

Remaining risks:
- ...
```

Use SECURITY READY only when required evidence for the actual changed boundary has completed.

## Rollback

This skill is instruction-only. Removing it and its manifest entry must not alter L.U.M.I.A. runtime behavior.
