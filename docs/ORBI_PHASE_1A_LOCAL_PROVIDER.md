# ORBI JARVIS Agent Lab — Phase 1A Local Provider

## Goal

Replace the mandatory Claude brain path with an optional fully local Ollama path while preserving the existing browser, voice and holographic UI contract.

## Selected first model

Default local model: `qwen3:4b`

Reason: it is already installed on the ORBI development laptop and is a better conversation/agent balance than `qwen3:1.7b`, while remaining substantially lighter than `qwen2.5-coder:7b`.

Available local models observed during certification:

- `qwen3:1.7b`
- `qwen3:4b`
- `qwen2.5-coder:7b`

## Launch

```powershell
npm run start:local
```

This starts the normal face and bridge, but sets `JARVIS_PROVIDER=ollama` for the bridge.

Optional overrides:

```powershell
$env:JARVIS_OLLAMA_MODEL="qwen3:1.7b"
npm run start:local
```

or:

```powershell
$env:JARVIS_OLLAMA_MODEL="qwen2.5-coder:7b"
npm run start:local
```

## Phase 1A scope

Included:

- Local Ollama availability probe
- Streaming `/api/chat` adapter
- Conversation history per WebSocket session
- Existing browser frame protocol: `ready`, `text`, `done`, `error`
- Existing barge-in / interrupt path through AbortController
- Existing UI, microphone, wake/listening and TTS remain unchanged
- No Claude CLI or Anthropic API key required for the local path

Deliberately deferred to Phase 1B:

- MCP/tool calling from the local model
- Browser actions
- Camera tool calls
- File/shell execution
- Permission-gated effectful local tools

This separation is intentional: first certify that the local brain can converse through the untouched JARVIS face; then add tools behind the existing permission boundary rather than bypassing it.

## Safety

The local provider does not gain tool access in Phase 1A. It cannot write files, run shell commands, control Chrome or call MCP tools. Tool execution will be reintroduced only after the local model/tool contract is separately validated.

## Phase 1A success criteria

1. `npm run lint` passes.
2. `npm run build` passes.
3. `npm run start:local` reports Ollama reachable and `qwen3:4b` installed.
4. Holographic UI boots normally.
5. A spoken Spanish prompt reaches Qwen locally.
6. Response streams back into the existing UI.
7. Existing TTS speaks the answer.
8. Barge-in interrupts local generation cleanly.
9. No Claude CLI or cloud API is required.
