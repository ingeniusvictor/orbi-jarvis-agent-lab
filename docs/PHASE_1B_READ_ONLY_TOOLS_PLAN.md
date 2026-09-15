# Phase 1B — L.U.M.I.A. Read-Only Tools Foundation

## Goal

Give the local O.R.B.I.A. / L.U.M.I.A. provider its first real capabilities
without granting effectful actions.

Phase 1A proved the local conversational path, Spanish voice/HUD flow, local
Ollama warm-up and the first holographic L.U.M.I.A. avatar prototype. Phase 1B
must preserve that stable path while adding tools behind an explicit contract.

## Safety boundary

Phase 1B starts **read-only**.

Allowed classes:

- inspect local runtime state;
- read capability/status information;
- query explicitly read-only providers;
- read camera/vision snapshots only when the user asks and permission already
  exists;
- read-only MCP tools that pass the existing bridge permission policy.

Not allowed in the first Phase 1B increment:

- shell execution;
- file writes or deletes;
- browser clicks or typing;
- sending email/messages;
- installing software;
- changing devices;
- purchases/payments;
- any MCP tool whose effect cannot be proven read-only.

The existing `JARVIS_ALLOW_WRITES` gate remains authoritative. Local Qwen must
never bypass it.

## Delivery sequence

### 1B-A — Local tool contract

Create a provider-neutral tool registry with:

- stable tool names;
- JSON input schemas;
- Spanish descriptions for the local model;
- explicit `read_only` metadata;
- deterministic execution result envelopes;
- timeout/error handling.

Initial diagnostic tools should be deliberately harmless, such as:

- `orbi_runtime_status`
- `orbi_capabilities`

These prove model -> tool request -> bridge execution -> result -> final answer
without touching the outside world.

### 1B-B — Ollama tool loop

Teach the Ollama session to:

1. receive the user's request;
2. expose only the Phase 1B allowlisted tools;
3. inspect Qwen tool calls;
4. validate tool name and JSON arguments;
5. execute only through the registry;
6. append the tool result back to the model;
7. obtain one final Spanish spoken answer;
8. stop after a bounded number of tool rounds.

No raw chain-of-thought is surfaced.

### 1B-C — Existing read-only bridge capabilities

After 1B-A/B are certified, adapt selected existing bridge/MCP capabilities
through the same permission decision used by the Claude path.

Do not hand the entire MCP surface directly to the local model.

## Certification

Phase 1B is PASS only when all of the following succeed:

1. Normal no-tool conversation still works for five consecutive turns.
2. A diagnostic tool can be called and its result is explained in Spanish.
3. Unknown tool names are rejected.
4. Malformed tool arguments are rejected safely.
5. A write/effectful tool request is denied while writes are disabled.
6. Tool execution has a timeout and cannot hang the session indefinitely.
7. Barge-in/interrupt still aborts the active local turn.
8. No internal reasoning or raw JSON/tool envelope is spoken.
9. The holographic UI remains responsive during a tool turn.
10. `npm run lint` and `npm run build` pass.

## Phase 1B visual rule

L.U.M.I.A. remains the primary presence in the reactor. Tool execution may later
drive a distinct ACTING state in the hologram, but Phase 1B must not regress the
current frontal presentation, optical centering or voice responsiveness.
