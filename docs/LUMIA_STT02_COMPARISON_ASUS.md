# STT-02 — Local free recognition comparison, separate from production

Purpose: compare accuracy of the same Spanish recording spoken naturally by both household speakers. This is a benchmark, not a production model switch. The script runs installed Whisper Base and Whisper Small via existing whisper-cli and optionally compares a Moonshine transcript saved separately to a text file.

Inputs: local 16kHz mono PCM WAV + correct human reference transcript UTF-8. Keep all private inputs under ignored .local-runtime/stt02. No audio upload, no auto-download, no cloud endpoint. Command:

npm run voice:benchmark:stt02 -- --wav .local-runtime/stt02/test.wav --reference-file .local-runtime/stt02/reference.txt

To include Moonshine: separately install moonshine-voice (MIT) and its Spanish Small Streaming model with explicit owner consent. Official CLI: moonshine-voice download --stt --language es; use moonshine-voice transcribe --help for the current file argument options. Save its transcript text and add --moonshine-file .local-runtime/stt02/moonshine.txt. Moonshine latency must be measured separately.

Whisper Small multilingual ggml-small.bin official: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin ; SHA256 1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b. Place it under .local-runtime/whisper.cpp/models/. Do not download ggml-small.en.bin: it is English-only. Download is never automatic.

Compare Word Error Rate (WER), real elapsed time, and false wake/TV phrases under identical audio. CI verifies the math, not ASR quality on ASUS. No runtime switch or model download is performed.