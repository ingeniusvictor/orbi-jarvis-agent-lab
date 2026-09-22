---
name: orbi-lumia-agent-harness
description: Design and review L.U.M.I.A. agent/tool action spaces, observations, recovery and stop conditions with explicit authority separation. Use when adding or changing tools, provider actions, voice-mediated actions, browser/file/process capabilities, agent handoffs or structured agent output.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC agent-harness-construction 2.2.2
  source_pattern: ORBI selective ECC pilot
  rollback_strategy: Remove this skill, the L.U.M.I.A. observation schema/validator/certification and its profile registration. Product runtime must remain independent.
---

# ORBI L.U.M.I.A. Agent Harness

Use this skill whenever L.U.M.I.A. or an engineering agent receives a new action, tool, observation or recovery path.

## Core model

Harness quality depends on:

1. action-space quality;
2. observation quality;
3. recovery quality;
4. context quality;
5. authority separation;
6. human-consent separation for privacy/identity-sensitive actions.

A successful model response or tool call is evidence about execution, not permission to cross another boundary.

## 1. Action-space tiers

### Read-only observation

Examples:

- inspect repository state;
- read CI evidence;
- query runtime status;
- list providers/tools;
- inspect voice-gate readiness.

May be broad enough to diagnose but must not mutate state.

### Local reversible mutation

Examples:

- isolated feature-branch edits;
- generated local reports;
- disposable test artifacts.

Require diff/evidence and rollback.

### External write

Examples:

- create/update PRs or issues;
- send external messages;
- browser form submission;
- write to a remote service.

Requires explicit task authorization and a concrete result identifier.

### Sensitive local action

Examples:

- microphone/camera capture;
- speaker enrollment;
- persistent provider preference change;
- local file write;
- launching a local runtime/process.

Requires the narrowest capability and explicit lifecycle/consent rules.

### Privileged/governed action

Examples:

- enabling `JARVIS_ALLOW_WRITES`;
- changing provider secrets;
- treating a speaker match as authorization;
- changing security policy;
- installing/enabling hooks, MCP or autonomous loops.

Never hide these inside a generic tool.

## 2. L.U.M.I.A. authority separations

Preserve:

`MODEL RESPONSE != TOOL/WRITE AUTHORITY`

`READ ACCESS != WRITE ACCESS`

`SPEAKER SIMILARITY != IDENTITY PROOF`

`SPEAKER MATCH != AUTHORIZATION FOR SENSITIVE ACTION`

`ENROLLMENT != ANTI-REPLAY READY`

`FALLBACK SUCCESS != PERMANENT PREFERENCE CHANGE`

`CI CONTRACT PASS != WORKSTATION/HARDWARE READY`

## 3. Observation contract

Structured agent observations use:

`.orbi/lumia-agent-observation-v1.schema.json`

Validator:

```bash
node scripts/validate-lumia-agent-observation.mjs <observation.json>
```

Harness certification:

```bash
node scripts/certify-lumia-agent-harness.mjs
```

Every observation must include:

- schemaVersion;
- status;
- concise summary;
- nextActions;
- artifacts;
- evidence;
- authorityImpact;
- localEvidenceRequired.

Errors must additionally include recovery:

- rootCauseHint;
- safeRetry;
- stopCondition.

## 4. Evidence quality

Prefer concrete evidence references:

- certification command/result;
- workflow run ID;
- commit SHA;
- artifact digest;
- runtime probe;
- workstation doctor;
- explicit human consent/approval.

Do not turn these into READY by themselves:

- a model answered;
- a file exists;
- a tool returned success;
- a PR is mergeable;
- a scanner score improved;
- a voice similarity score crossed threshold.

Use `orbi-lumia-verification-loop` for readiness and `orbi-lumia-security-review` for sensitive boundaries.

## 5. Recovery rules

A retry must change at least one of:

- hypothesis;
- input;
- scope;
- evidence source;
- implementation.

Do not repeat the same failed action indefinitely.

Stop when:

- the same root cause repeats without new evidence;
- the next action would cross an unauthorized boundary;
- required human consent is absent;
- required workstation evidence is unavailable;
- state is ambiguous enough that mutation would be unsafe.

## 6. Voice-mediated tool requests

Voice input is untrusted command input until the applicable policy accepts it.

For sensitive actions, distinguish:

1. transcript recognized;
2. intended speaker classification;
3. speaker verification, if applicable;
4. anti-replay/liveness, if required;
5. explicit user intent/confirmation;
6. tool permission;
7. execution result.

Never collapse those stages into one boolean.

## 7. Observation privacy

Do not place in structured observations:

- provider secret plaintext;
- raw voice recordings;
- speaker embeddings/profiles;
- private camera frames;
- cookies/session credentials;
- unredacted sensitive filesystem content.

Reference sanitized artifacts instead.

## 8. Context discipline

Load only the skill/instructions needed for the task.

Do not inject every ECC/ORBI skill into every turn.

Memory, if added later, remains context and cannot override:

- permissions;
- consent;
- enrolled identity state;
- anti-replay state;
- security policy;
- canonical repository evidence.

## 9. Result

Return observations that can be validated deterministically when a structured handoff is needed.

If the next step requires a governed boundary, set `authorityImpact.requiresHumanApproval=true` rather than implying permission.

## Rollback

This skill and its development-time schema/validator are not product runtime dependencies. Removing them must not change L.U.M.I.A. user-facing behavior.
