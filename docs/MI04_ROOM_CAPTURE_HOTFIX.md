# MI-04 Room Capture Reliability Hotfix

Purpose: harden in-person (`platform=room`) capture so a diarization failure or unusable diarization segmentation cannot silently drop an otherwise transcribable microphone chunk.

Guardrails:
- Keep MI-04 speaker tracking and diarization as the preferred path.
- Fall back to whole-chunk local STT only when diarization fails or produces no usable transcribed turns.
- Preserve process-memory-only anonymous speaker embeddings.
- Do not change online meeting capture paths (Teams/Zoom/Meet).
