---
name: orbi-lumia-context-budget
description: Audit L.U.M.I.A. agent-instruction overhead without assuming every available skill or config file is permanently loaded. Use after adding AGENTS instructions, project skills, agent schemas/configuration, or when agent context becomes noisy or repetitive.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC context-budget 2.2.2
  source_pattern: ORBI selective ECC pilot
  rollback_strategy: Remove this skill, its audit/certification scripts, CI step and profile registration. Product runtime does not depend on it.
---

# ORBI L.U.M.I.A. Context Budget

Use this skill to keep the L.U.M.I.A. engineering-agent surface intentional and small enough to reason about.

## Core rule

Do **not** count a repository file as persistent model context merely because it exists.

Classify first:

- **always-instructions** — root/harness instruction files expected to shape sessions;
- **discoverable-skill** — project skills available for on-demand use;
- **config-reference** — manifests/schemas/config to inspect only when relevant;
- **other** — not part of the governed agent-context budget.

## Deterministic auditor

```bash
node scripts/ecc-lumia-context-budget.mjs
node scripts/ecc-lumia-context-budget.mjs --json
```

Certification:

```bash
node scripts/certify-lumia-context-budget.mjs
```

## Governed surfaces

The auditor recognizes:

- `AGENTS.md`;
- optional `CLAUDE.md` / `.codex/AGENTS.md` if introduced later;
- `.agents/skills/*/SKILL.md`;
- `.orbi/ecc-profile.json`;
- `.orbi/lumia-agent-observation-v1.schema.json`;
- optional `.mcp.json` / `.codex/config.toml` if introduced later.

It does not scan all `docs/` and call them prompt overhead.

## Interpretation

Token numbers are estimates, not live-model telemetry.

The report separates:

1. estimated persistent instruction overhead;
2. total discoverable-skill size if every skill were fully read;
3. config-reference size if fully read.

Only category 1 is treated as persistent repository instruction overhead.

## Review triggers

The auditor flags, but does not fail on:

- always-instruction files over 150 lines;
- discoverable skills over 250 lines.

A flag is not permission to delete safety-critical guidance.

## Optimization order

When context becomes too large:

1. remove exact duplication;
2. keep one authoritative statement for each invariant;
3. move task-specific procedures out of `AGENTS.md` into on-demand skills;
4. shorten examples before weakening safety boundaries;
5. keep tool/write, biometric, secret and privacy boundaries explicit;
6. do not enable MCP/memory merely to compensate for poor instruction structure.

## L.U.M.I.A. non-negotiable context

Do not optimize away distinctions such as:

- model response vs tool/write authority;
- speaker similarity vs identity proof;
- speaker match vs sensitive-action authorization;
- enrollment vs anti-replay readiness;
- CI contract pass vs workstation/hardware readiness;
- fallback success vs persistent preference change;
- agent memory vs canonical evidence.

## MCP and tool-schema cost

Do not claim a live MCP/tool-schema token cost unless the live tool schema is actually available.

Repository configuration alone cannot prove runtime tool-schema overhead.

## Completion report

Record:

- persistent instruction estimate;
- discoverable-skill estimate;
- config-reference estimate;
- largest surfaces;
- flags;
- duplicated guidance;
- proposed savings;
- safety/authority text intentionally retained.

## Rollback

This is development tooling + guidance. Removing it must not alter L.U.M.I.A. runtime behavior.
