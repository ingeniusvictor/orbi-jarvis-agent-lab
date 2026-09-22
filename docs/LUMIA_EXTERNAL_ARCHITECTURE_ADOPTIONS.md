# L.U.M.I.A. — external architecture adoption notes

This branch incorporates ideas discovered while reviewing the public MIT-licensed
project `sosoj92/jarvis-assistant-vocal`, but the implementations in this
repository are written for L.U.M.I.A.'s existing TypeScript/Node architecture.

## Adopted concepts

- Adaptive room-noise handling and speaker-echo observation.
- Multi-microphone wake arbitration for future ORBI Edge Mesh voice nodes.
- Intent-first tool-domain scoping for small local models.
- N1/N2/N3-style capability risk classification.
- Privacy redaction for non-user-facing logs/summaries.
- Explicit voice latency telemetry.

## Intentionally not copied

- The monolithic Python voice loop.
- Its memory.json architecture.
- faster-whisper replacement for our certified whisper.cpp path.
- Piper replacement for the certified Kokoro path.
- Its LAN satellite transport/security as-is.
- Any claim that diarization alone detects TV/replay audio.

## L.U.M.I.A. extensions beyond the donor project

- Local sherpa-onnx diarization with isolated runtime.
- 512-dimensional speaker embeddings.
- DPAPI-protected speaker profile design.
- Voice Gate LIVE / UNCERTAIN / BACKGROUND contract.
- Planned anti-replay/liveness fusion.
- Hybrid local/cloud provider router.
- ORBI Edge Mesh-compatible arbitration contract.

No external source code is required at runtime by these adaptations.
