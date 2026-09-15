# Phase 1A — Local Spanish Certification Plan

This checklist is intentionally narrow. It certifies the local conversation path before tools, vision calls or computer control are reintroduced.

## Preconditions

- Ollama service is running.
- `qwen3:4b` is installed.
- Current lab branch builds cleanly.
- Browser microphone permission is granted.
- No write-enabled bridge mode is used.

## Brain isolation test

Run the base model directly:

```powershell
ollama run qwen3:4b
```

Prompt:

```text
Respóndeme únicamente en español latinoamericano. ¿Quién eres y qué puedes hacer? Responde en dos frases.
```

Record whether the text itself is clean Spanish before evaluating TTS.

## ORBIA/LUMIA model preparation

On the foundation branch:

```powershell
npm run model:lumia
```

Then:

```powershell
ollama run orbia-lumia:4b
```

Recommended prompts:

1. `Hola, preséntate en una frase.`
2. `¿Cómo te llamas?`
3. `Explícame qué es un inversor fotovoltaico en dos frases.`
4. `What is your name?` — expected Spanish unless explicitly asked to answer in English.
5. `Responde esta vez en inglés: what can you do?` — expected English.

## JARVIS-lab UI test

After the provider points to the certified local model:

- UI boots.
- Wake/listening works.
- User speech is transcribed in Spanish.
- Final visible answer contains no hidden reasoning.
- Spoken answer matches the visible final answer.
- No unexplained English meta-commentary is spoken.
- Barge-in interrupts generation cleanly.
- Follow-up question retains short conversational context.
- Bridge remains connected for at least five consecutive turns.

## Phase 1A exit criteria

Phase 1A is PASS only when five consecutive Spanish turns succeed without:

- reasoning leakage;
- unexpected English commentary;
- bridge disconnect;
- malformed response envelope;
- silent TTS failure.

Only after that should Phase 1B add local tools/MCP.
