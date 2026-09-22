# LUM-ECC-P6 — L.U.M.I.A. Agent Harness

Status: PROJECT SKILL + DEVELOPMENT CONTRACT

## Goal

Materialize:

- `.agents/skills/orbi-lumia-agent-harness/SKILL.md`
- `.orbi/lumia-agent-observation-v1.schema.json`
- `scripts/validate-lumia-agent-observation.mjs`
- `scripts/certify-lumia-agent-harness.mjs`

and add the deterministic harness certification to the LUMIA ECC PR gate.

## Why this skill is high-value here

L.U.M.I.A. is itself an agent/tool system.

Its correctness depends on more than prompting:

- action-space boundaries;
- read/write separation;
- structured observations;
- voice/speaker evidence separation;
- recovery behavior;
- stop conditions;
- consent and human approval;
- privacy-safe handoffs.

## Contract additions

The v1 observation contract requires:

- status + summary;
- next actions;
- artifacts;
- evidence;
- explicit authority impact;
- whether workstation/local evidence is still required;
- recovery details for errors.

Authority domains include tool writes, provider secrets, speaker identity, anti-replay, camera/mic, local runtime, network/SSRF, provider preference, agent memory and canonical Git.

## CI

P6 adds:

```bash
node scripts/certify-lumia-agent-harness.mjs
```

to `.github/workflows/lumia-ecc-pr-gate.yml`.

The certification proves only the development-time observation contract. It does not prove any product runtime, speaker identity or hardware readiness.

## Safety

- no product code imports this validator;
- no existing tool permissions are expanded;
- no hook/MCP/memory/continuous learning/autonomous loop is enabled;
- no speaker/profile data is persisted;
- no runtime path depends on the new files.

## Rollback

Remove the P6 skill/schema/validator/certification and revert the PR-gate step/profile registration. Product runtime behavior must remain unchanged.
