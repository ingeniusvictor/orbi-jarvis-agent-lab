# LUM-ECC-P7 — L.U.M.I.A. Context Budget

Status: PROJECT SKILL + DEVELOPMENT AUDITOR

## Goal

Materialize:

- `.agents/skills/orbi-lumia-context-budget/SKILL.md`
- `scripts/ecc-lumia-context-budget.mjs`
- `scripts/certify-lumia-context-budget.mjs`

and add context-budget certification to the ECC PR gate.

## Model

P7 separates:

1. always-instructions;
2. discoverable skills;
3. config references.

Only always-instructions are counted as persistent repository instruction overhead.

This prevents the core failure mode of treating every installed/available skill as if it were injected into every task.

## Estimates

The auditor reports heuristic token estimates based on word/character counts.

These values are useful for revision-to-revision comparison, not claims about exact runtime model context.

## Review triggers

- always-instruction >150 lines;
- discoverable skill >250 lines.

Triggers are informational and non-blocking.

## L.U.M.I.A. constraints

Context optimization must not remove or blur:

- tool/write authority boundaries;
- provider-secret handling;
- speaker identity/anti-replay separation;
- camera/microphone privacy;
- CI vs workstation evidence;
- fallback vs persisted preference;
- memory vs canonical evidence.

## CI

P7 adds:

```bash
node scripts/certify-lumia-context-budget.mjs
```

to the ECC PR gate.

## Safety

No product runtime imports the auditor.
No hooks/MCP/memory/continuous learning/autonomous loops are enabled.
No runtime permission changes.

## Rollback

Remove the P7 skill/auditor/certification, revert its CI step and profile registration.

## First measured result

ECC PR gate run `35678740081` executed the P7 auditor successfully on the P7 branch state.

Observed:

- always-instructions: 1;
- discoverable skills: 4;
- config references: 2;
- estimated persistent instruction overhead: ~1,339 tokens;
- discoverable skills if all four were fully read: ~3,865 tokens;
- config references if fully read: ~1,139 tokens.

Flags:

- `AGENTS.md`: `large-always-instruction` (>150 lines).

Interpretation:

- the 3,865-token skill total is **not** persistent context;
- the only persistent repository-instruction estimate is ~1,339 tokens;
- the `AGENTS.md` size flag is a review trigger, not a failure;
- no safety/authority boundary should be removed merely to clear the flag.

The same gate run passed brain contracts, Voice Gate contracts, P6 agent-harness certification, P7 context-budget certification, production build and lint.
