# L.U.M.I.A. — SKILL-01 | Runtime Skill Registry

## Problem
Qwen cannot infer which features are installed, enabled or certified.
The pilot previously denied existing translation features. Static prompt
descriptions get stale as new modules are added.

## Canonical read-only contract
Module: bridge/orbia/skill-registry-skill01.mjs

Exports:
- buildLumiaSkillRegistry(): immutable snapshot with schema/version/capabilities.
- isSkillRegistryInquiry(prompt): only informational skill/memory questions.
- skillRegistryReply({prompt, registry}): grounded spoken Spanish summary.

Each entry declares stable id, name, version, state, description, limitation
and source. Allowed states are configured / experimental / disabled /
unavailable / pending. Configured means selected and preconditions present,
NOT that a real operation has been end-to-end verified.

Inputs are actual bridge environment switches, the existing RC-04 translator
runtime evaluator, and local Whisper/Kokoro asset probe. Snapshots are
computed at inquiry time rather than baked into a permanent prompt.

No external network, microphone access, file write, memory persistence,
third-party skill installation or additional tool permission is granted.

## Initial catalog
- Ollama conversation and process-local short session context
- Whisper STT, Kokoro TTS
- LT-01/LT-04Q text translation, LT-05 selected audio translation
- Experimental owner-selected photo input
- Specific diagnostic/model/voice commands
- Persistent memory MEM-01: PENDING
- Weather nowcasting/live forecast: UNAVAILABLE
- General desktop automation: UNAVAILABLE
- Continuous multilingual interpretation: PENDING

The current conversation store is ephemeral, at most four recent exchanges.
It does NOT survive bridge restarts. Do not represent that as memory between
sessions or allow an environment toggle to falsely mark MEM-01 installed.

## Registering new capabilities
1. Implement the module and permission checks independently.
2. Add its manifest entry and state evaluator to the central registry;
   derive status from the real switches/assets, not roadmap claims.
3. Include a truthful limitation and stable version/ID.
4. Test enabled, disabled, missing prerequisites, and no unauthorized actions.
5. Validate CI plus physical ASUS before claiming real operational success.
6. For MEM-01 specifically, implement owner consent, local persistence,
   retrieval, retention, correction and deletion first; register only then.

## ASUS pilot and rollback
The pilot launcher opts in using ORBIA_LUMIA_SKILL_REGISTRY=1.
On skill inquiries, the registry is authoritative. RC-04's obsolete static
translation paragraph is suppressed while SKILL-01 is enabled; regular Qwen
responses and RC-03, VQ-01, STT, TTS, avatar and permissions remain unchanged.
To roll back, set the pilot switch to 0 and restart LUMIA.
