# LUM-ECC-P4 — L.U.M.I.A. Verification Skill

Status: PROJECT SKILL / INSTRUCTION-ONLY

## Goal

Materialize the first ORBI-owned project skill for L.U.M.I.A.:

`.agents/skills/orbi-lumia-verification-loop/SKILL.md`

## Adaptation

The skill is inspired by ECC `verification-loop` and the Creative Studio ORBI adaptation, but it is rewritten for L.U.M.I.A.'s actual evidence model.

Key differences:

- certification scripts replace a conventional unit-test tree;
- CI and workstation evidence are explicitly separated;
- voice/speaker/anti-replay readiness states cannot be collapsed;
- provider fallback is not permanent preference mutation;
- model/tool output does not authorize writes;
- voice/biometric privacy is a readiness concern.

## Safety

P4 is instruction-only:

- no product/runtime source change;
- no hooks;
- no MCP;
- no memory;
- no continuous learning;
- no autonomous loops;
- no tool/write permission change.

## Exit criteria

- AgentShield report-only remains GREEN with no new finding class;
- LUMIA ECC PR gate remains GREEN;
- the skill is registered in the ECC manifest;
- removal of the skill would not change product runtime.
