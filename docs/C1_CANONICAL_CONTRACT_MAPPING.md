# C1 — Canonical Contract Mapping

## Status

**C1 STARTED — CONTRACT FOUNDATION CREATED**

This document maps the current holographic Companion runtime against the mature
legacy LUMI core so the two products converge without a bulk repository merge.

## Principle

There will be:

- one L.U.M.I.A. identity;
- one O.R.B.I.A. core contract;
- one conversation identity per session;
- one knowledge envelope;
- one permission boundary;
- one tool request/result contract;
- multiple interfaces (Companion, Studio, Widget).

Interfaces are views. They are not separate assistants.

## Current Companion runtime

Repository:

`ingeniusvictor/orbi-jarvis-agent-lab`

Branch:

`feature/orbia-lumia-convergence-foundation`

Current strengths:

- holographic UI and GLB companion;
- wake/listen/think/speak state flow;
- WebSocket bridge;
- low-latency local Ollama qwen3:4b route;
- structured final-answer JSON suppression of reasoning leakage;
- barge-in/interrupt;
- camera/gesture experiments;
- inherited Claude/MCP bridge and permission logic.

Current weaknesses relative to legacy LUMI:

- identity is encoded directly in the provider prompt;
- conversation history belongs to a WebSocket session;
- no canonical KnowledgeContext in the local Ollama path;
- local Ollama tool loop is not implemented;
- browser voice path remains transitional;
- provider/runtime/tool envelopes are not yet unified with Studio.

## Legacy LUMI source

Repository:

`ingeniusvictor/orbi-chatbox-ia-core`

Reference branch:

`feature/0k-36-commercial-hardening`

### Identity

Legacy sources:

- `server/src/data/lumiIdentity.ts`
- `server/src/data/lumiBehaviorPolicy.ts`
- `server/src/services/assistantInstructionComposer.ts`
- `server/src/services/assistantRuntimeInstructionComposer.ts`
- `server/src/services/assistantBehaviorPolicyComposer.ts`

Decision: **REUSE / ADAPT**

The identity and behavior principles become provider-neutral O.R.B.I.A. data.
The Companion voice runtime uses a compact projection of the same identity.

### Conversation / memory

Legacy source:

- `server/src/memory/conversationMemory.ts`

Legacy contract:

```text
StoredConversationTurn
  turnId
  userText
  assistantText
  createdAt

ConversationRecord
  conversationId
  turns[]
```

Current Companion contract:

```text
WebSocket session
  history[]
    role
    content
```

Decision: **ADAPT**

The canonical contract uses atomic `user|assistant` turns plus a stable
`conversationId`. A storage adapter may later group user+assistant pairs for
legacy compatibility.

Do not make the WebSocket itself the long-term memory identity.

### Knowledge

Legacy sources:

- `server/src/services/knowledgeContextBuilder.ts`
- `server/src/types/knowledge.ts`

Legacy bounded context:

- max 3 entries;
- max 1200 characters;
- local/structured provenance;
- truncation flag;
- no arbitrary Internet grounding.

Decision: **REUSE**

The current Companion provider should receive the same canonical knowledge
envelope before any broader RAG work is added.

### Tool Engine

Legacy sources:

- `server/src/tools/toolEngine.ts`
- `server/src/tools/toolInteractionLoop.ts`

Useful guarantees already present:

- registry;
- explicit tool names;
- validation;
- allowlist;
- bounded timeout;
- bounded output;
- bounded loop steps;
- structured failures.

Decision: **REUSE / HARDEN**

Do not rebuild a second local tool engine from scratch.

The current bridge also contains valuable Claude/MCP permission classification.
C2/C4 should combine the legacy deterministic ToolExecutor with the current
bridge permission knowledge rather than discarding either.

### Voice

Legacy source:

- `server/src/services/createTextToSpeechProvider.ts`

Legacy route:

```text
Whisper.cpp -> O.R.B.I.A./LUMI -> Kokoro local -> SAPI fallback
```

Decision: **REUSE AFTER CONTRACT CONVERGENCE**

The current browser STT/TTS remains transitional until the local voice route is
migrated without regressing latency/barge-in.

### Runtime telemetry

Legacy source:

- `server/src/services/runtimeTelemetry.ts`

Decision: **REUSE LATER**

Telemetry is valuable but should not block identity/knowledge/tool convergence.

## Canonical C1 contracts

The convergence branch now defines provider-neutral runtime shapes in:

`bridge/orbia/contracts.mjs`

Initial contracts:

- ConversationTurn
- KnowledgeContext
- ToolRequest
- ToolResult
- PermissionDecision
- RuntimeState

They intentionally contain no Ollama, Claude, React, Three.js or Chat Studio
dependencies.

## Canonical identity

The convergence branch now defines:

`bridge/orbia/lumia-identity.mjs`

This preserves the mature LUMI identity principles while supplying a compact
voice-runtime projection to the current Companion provider.

## Migration order

### C1-A — Identity contract

**IMPLEMENTED — runtime validation pending.**

Replace the hard-coded local provider identity text with the canonical LUMI
identity composer while preserving the current voice-specific restrictions.

### C1-B — Conversation identity

**IMPLEMENTED — runtime validation pending.**

Current implementation:

- browser session creates a stable `conversationId`;
- reconnects reuse that identity while the bridge process remains alive;
- Ollama history is stored in a bounded process-local canonical store;
- persistence remains intentionally disabled for C1.

### C1-C — Knowledge envelope

Then:

- port legacy bounded local knowledge behind the canonical KnowledgeContext;
- expose provenance/source IDs;
- keep current qwen3:4b provider.

### C1-D — Tool contract

Then:

- port registry/executor/timeout/allowlist semantics;
- start with read-only diagnostic tools;
- surface tool frames to the existing holographic `tooling` state.

### C1-E — Local voice

After the conversation/provider path remains stable:

- Whisper.cpp primary STT;
- Kokoro primary TTS;
- browser/SAPI controlled fallback;
- preserve barge-in.

## Explicit deferrals

Not part of C1:

- WhatsApp live integration;
- business lead-writing tools;
- file/shell writes;
- autonomous browser actions;
- cloud memory;
- multi-client SaaS configuration;
- L.U.M.I.A. Kids implementation.

Those remain preserved for later phases.


## C1 certification command

Run:

```bash
npm run certify:c1
```

This smoke test validates the canonical identity projection, conversation store, KnowledgeContext, ToolRequest/ToolResult, PermissionDecision and RuntimeState contracts. It does not replace lint/build/runtime voice testing.
