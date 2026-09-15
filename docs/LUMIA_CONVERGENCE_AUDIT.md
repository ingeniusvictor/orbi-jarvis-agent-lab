# L.U.M.I.A. Convergence Audit — Legacy Core + Holographic Companion

## Decision

Do **not** merge the two repositories wholesale.

The canonical product direction is one L.U.M.I.A. backed by one O.R.B.I.A. core
and exposed through multiple interfaces.

The current holographic lab becomes the reference implementation for the
Companion experience. The previous ORBI ChatBox IA Core remains the source of
mature backend/product capabilities that should be migrated selectively.

## Sources

### Holographic / companion source

Repository:

`ingeniusvictor/orbi-jarvis-agent-lab`

Current convergence branch:

`feature/orbia-lumia-convergence-foundation`

Keep from this codebase:

- holographic Three.js scene;
- L.U.M.I.A. GLB presence;
- wake/listen/think/speak state machine;
- low-latency local Ollama route;
- current Spanish identity;
- browser bridge transport;
- visual tools/blades/panels where useful;
- camera and gesture experiments after safety review.

### Legacy LUMI / product-core source

Repository:

`ingeniusvictor/orbi-chatbox-ia-core`

Reference branch:

`feature/0k-36-commercial-hardening`

This branch is the preferred migration source because it includes the later
post-MVP work built on top of the earlier LUMI milestones.

Candidate capabilities to preserve/adapt:

- LUMI identity/personality contract;
- structured/local Knowledge Engine;
- bounded conversation continuity;
- controlled capability boundary;
- frontend Chat Studio UX;
- local voice foundation (Whisper.cpp + Kokoro local, with controlled fallback);
- multichannel contracts;
- persistent-memory/context work;
- LUMI Tool Engine;
- business tools pack;
- runtime telemetry/readiness;
- client configuration;
- commercial hardening;
- Web/WhatsApp channel architecture where still applicable.

## Target architecture

```text
ORBI Ecosystem
    |
    +-- O.R.B.I.A. Core
          |
          +-- Identity / L.U.M.I.A.
          +-- Provider Router
          +-- Knowledge Engine
          +-- Conversation / Memory
          +-- Tool & Permission Engine
          +-- Voice
          +-- Vision
          +-- Channels
          +-- Telemetry
          |
          +-- Interfaces
                |
                +-- Companion Mode
                |     hologram + voice + avatar
                |
                +-- Studio Mode
                |     full chat + data + workspaces
                |
                +-- Widget Mode
                      compact client/web interface
```

All three interfaces must consume the same canonical conversation/tool contracts.
No interface owns a separate personality, memory or brain.

## Migration classification

### KEEP — current holographic lab

- Scene / reactor / particles / HUD
- L.U.M.I.A. avatar prototype
- O.R.B.I.A. startup identity
- local qwen3:4b warm-up path
- current speech-turn state machine
- bridge protocol as an integration shell

### REUSE / ADAPT — legacy ORBI ChatBox IA Core

- Knowledge Engine
- LUMI personality contracts
- conversation context/memory contracts
- Tool Engine contracts and QA
- Whisper.cpp STT foundation
- Kokoro local TTS foundation
- telemetry/readiness
- client profile/configuration
- Chat Studio
- Web Widget architecture

### AUDIT BEFORE MIGRATION

- WhatsApp runtime and live guards
- commercial/business tool pack
- human handoff
- channel delivery services
- any persistent-memory implementation
- any effectful tool

These may be useful, but they must enter the unified product through the same
permission and identity boundaries.

### REPLACE / RETIRE

- JARVIS visual identity and boot presentation
- duplicated assistant identities
- duplicated provider abstractions
- duplicated tool registries
- duplicated conversation-memory stores
- legacy demo-only response engines once the canonical O.R.B.I.A. runtime owns
  the route

## Convergence phases

### C0 — Freeze and map

- Freeze current holographic V1 visually.
- Freeze legacy reference branch.
- Record module ownership and contracts.
- No bulk copy.

### C1 — Canonical contracts

Define provider-neutral contracts for:

- conversation turn;
- assistant identity;
- knowledge context;
- memory/context envelope;
- tool request/result;
- permission decision;
- runtime state.

### C2 — Knowledge + identity

Migrate the legacy LUMI identity and Knowledge Engine behind the holographic
bridge without changing the current visual UX.

### C3 — Voice convergence

Replace browser-dependent STT/TTS progressively with the certified legacy local
voice path:

```text
Mic -> Whisper.cpp -> O.R.B.I.A. -> Kokoro local -> audio
```

Keep browser speech only as fallback during transition.

### C4 — Memory + tools

Integrate the legacy memory/context contracts and Tool Engine through one
permission gate. Start read-only.

### C5 — Studio Mode

Bring the existing Chat Studio/workspaces into the unified product as a second
interface, not as a second assistant.

### C6 — Channels / productization

Only after the unified core is stable:

- widget;
- WhatsApp;
- business tools;
- client profiles;
- telemetry;
- commercial/runtime hardening.

## Non-negotiable rules

1. One L.U.M.I.A. identity.
2. One O.R.B.I.A. core contract.
3. One permission boundary.
4. One source of conversation truth per session.
5. Interfaces are views, not separate assistants.
6. No effectful legacy tool is migrated without explicit audit.
7. Every migration block must leave the holographic Companion path working.

## Immediate next step

Before implementing Phase 1B tools in the holographic lab, perform C1:
**Canonical Contract Mapping** between the legacy Tool/Memory/Knowledge contracts
and the current bridge/provider contracts.

That prevents rebuilding capabilities already present in the legacy repo.
