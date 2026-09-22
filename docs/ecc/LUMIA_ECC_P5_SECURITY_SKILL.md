# LUM-ECC-P5 — L.U.M.I.A. Security Review Skill

Status: PROJECT SKILL / INSTRUCTION-ONLY

## Goal

Materialize:

`.agents/skills/orbi-lumia-security-review/SKILL.md`

## Repository-specific adaptation

The skill is grounded in current L.U.M.I.A. surfaces, including:

- `bridge/providers/secure-secrets.mjs` — environment + Windows DPAPI provider secret path;
- `bridge/orbia/tool-engine.mjs` — explicit registry, allowlist, timeout and output bounds;
- `bridge/net.mjs` — centralized SSRF/DNS-rebinding/redirect gate;
- `src/lib/camera.ts` — ref-counted camera lifecycle and bounded memory-only rolling buffer;
- `bridge/orbia/speaker-verification.mjs` — local speaker embedding, DPAPI profile encryption, no raw enrollment-audio persistence;
- `bridge/orbia/speaker-enrollment-page.mjs` — explicit local enrollment flow.

## Security invariants

P5 makes these explicit for agent-assisted development:

- model output is not write authority;
- speaker similarity is not identity proof;
- a speaker match is not sufficient authorization for sensitive actions;
- enrollment and anti-replay readiness are distinct;
- network redirects must be re-vetted;
- local process execution must remain bounded and structured;
- agentic configuration cannot silently weaken product security.

## Safety

P5 is instruction-only:

- no product/runtime source change;
- no secret-store change;
- no speaker-profile change;
- no network-gate change;
- no tool permission change;
- no hooks/MCP/memory/continuous learning/autonomous loops.

## Exit criteria

- AgentShield shows no finding class outside the accepted lockfile-integrity baseline;
- LUMIA ECC PR gate is GREEN;
- skill is registered in the ECC profile;
- removing the skill would not alter runtime behavior.
