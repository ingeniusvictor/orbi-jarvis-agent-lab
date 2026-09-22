# ADR — Dedicated wake word for L.U.M.I.A.

## Decision

The canonical dedicated wake engine for L.U.M.I.A. will be **openWakeWord** with
an ORBI-owned custom `Lumi` ONNX model.

The existing transcript-based Lumi matcher remains the fallback until the custom
model is trained, installed and benchmarked.

Porcupine remains an optional adapter, not the canonical path.

## Why

### openWakeWord

- Open-source wake-word framework.
- Supports custom wake-word training and ONNX export.
- Threshold is deployment-calibrated rather than assumed universal.
- Supports an optional user-specific verifier layer.
- Fits future ORBI Edge Mesh nodes without requiring a browser credential.

Reference:
https://github.com/dscripka/openWakeWord

### Porcupine

The repository already depends on the Porcupine Web packages and its browser
integration is convenient. However the official Web SDK requires a Picovoice
AccessKey plus a custom Web keyword model. L.U.M.I.A. will not make a browser-
visible service credential a requirement for its canonical always-listening ear.

References:
https://picovoice.ai/docs/porcupine/
https://picovoice.ai/docs/quick-start/porcupine-web/

## Security boundary

A dedicated wake detector proves only that the trigger phrase was heard. It does
not prove the speaker is authorized or live.

Canonical order remains:

wake word -> speaker verification -> anti-replay/liveness -> STT -> brain

No wake model may bypass Voice Gate for sensitive capabilities.
