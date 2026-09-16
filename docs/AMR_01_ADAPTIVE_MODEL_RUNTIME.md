# AMR-01 — O.R.B.I.A. Adaptive Model Runtime

## Goal

L.U.M.I.A. must remain the same assistant while the underlying local model can
change according to the computer, the task or an explicit spoken request.

The model is an execution engine. Identity, conversation, knowledge and tools
remain in O.R.B.I.A. Core.

## Implemented foundation

- runtime-local active model state;
- installed-model inventory derived from Ollama;
- deterministic aliases:
  - fast / ligero / 1.7B;
  - balanced / principal / 4B;
  - coding / coder;
  - explicit 7B;
- voice intent parsing for model list and model switch requests;
- runtime status tool reports the currently active model dynamically;
- target model is validated against locally installed Ollama models;
- candidate model is warmed before activation;
- failed warm-up preserves the previous active model;
- conversation identity is preserved across a model switch;
- no application restart is required for a successful runtime switch.

## Initial spoken controls

Examples:

- "Lumi, ¿qué modelos puedo usar?"
- "Lumi, cambia al modelo rápido."
- "Lumi, usa el modelo equilibrado."
- "Lumi, cambia al modelo de código."
- "Lumi, usa el modelo 7B."

## Explicit deferrals

Not yet part of AMR-01:

- automatic hardware recommendations;
- GPU/VRAM benchmarking;
- automatic task routing between models;
- persistent per-device default profiles;
- downloading missing models automatically;
- unloading older models based on memory pressure.

Those belong to later AMR phases after runtime switching is locally certified.

## Certification

Run:

```bash
npm run certify:amr
npm run lint
npm run build
```

Then start L.U.M.I.A. and test the spoken controls above.
