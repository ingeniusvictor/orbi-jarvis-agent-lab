# LUMIA VL-08 — Bounded first phrase on buffered Ollama local output

On ASUS, Ollama's buffered JSON can deliver full responses in one callback. The original TTS sentence extraction ran before the local VL-07 first-chunk logic, which means a lengthy first sentence could reach Kokoro whole (150+ chars) and delay first playback.

VL-08 reorders the first local chunk: only in the opted-in ASUS Kokoro path, an initial full sentence over 88 chars is split once at a 32–88-character word/clause-safe boundary BEFORE full-sentence extraction. Short greetings are unchanged, original text is lossless, and subsequent sentences are unchanged. No additional concurrent ONNX jobs.

Security boundaries and assets unchanged: no changes to Whisper, activation/wake, microphone, user permissions, paid providers, avatar GLB or scale 0.92. Main branch remains untouched. CI checks text segmentation and build/lint; real ASUS timing and prosody need physical testing. Toggle VITE_LUMIA_FAST_FIRST_CHUNK to 0 to revert the local experiment.