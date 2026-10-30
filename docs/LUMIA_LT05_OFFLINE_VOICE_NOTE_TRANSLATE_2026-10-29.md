# LUMIA LT-05 — Manual offline translation of imported voice notes

## Purpose
Owner-approved audio files received via WhatsApp or saved locally can now be translated while LUMIA Translate is ON. This is NOT live interpretation and NEVER changes the default Spanish wake-word STT. The user manually chooses a source and target language: Spanish (es), English (en) or Mandarin Chinese (zh). The normal chat remains unaffected when Translate is OFF.

## ASUS entry point
1. Update feature branch and restart `INICIAR_LUMIA_ASUS_RAPIDA.cmd`.
2. Activate the compact **languages** icon; choose source and target languages. For a Chinese voice message, select 中文 (mandarín) → Español.
3. The existing attachment icon now becomes a small **audio waveform** while Translate is active. Choose a saved audio file and press the send arrow.
4. The HUD shows **Transcripción original** (Whisper) followed by **Traducción** (Qwen local). No voice synthesis is attempted for translated Mandarin or English; LT-06 will cover multilingual pronunciation.
5. If the model rejects translation on quality grounds, the original transcript remains available for review or alternate-language retry.

## Privacy and implementation
- Selected audio is decoded inside Chromium to 16 kHz mono PCM WAV by the existing WebAudio helper. Browser codec support varies by OS: accepted file types include .ogg, .opus, .m4a, .mp3, .wav and .webm, but decoding may fail for specific codecs. In that case, convert the voice message **offline** to WAV/MP3 first; the user remains in control. No automatic downloads or installations.
- `/translate/audio?source=zh&target=es` accepts only bounded WAV with up to 90 s of audio and exactly 16 kHz, 16-bit mono PCM. Raw audio is sent ONLY to the local 127.0.0.1 bridge, not to remote websites.
- Backend stores raw WAV and transient Whisper transcript within a temporary system folder, removed in a `finally` block; text returned to the local UI is intentionally visible in conversation history. It does not store a permanent copy of the audio.
- The bridge invokes installed `whisper-cli` with **explicit language** `-l zh`, `-l en` or `-l es`, not automatic language detection. It bypasses Spanish-specific vocabulary hints and the persistent Whisper server. A multilingual model such as `ggml-base.bin` is required; `.en.bin` models are rejected.
- Qwen local receives Whisper's transcript and applies existing LT-04Q bounded quality checks. The server is disabled unless both `ORBIA_LUMIA_TRANSLATE_ENABLED=1` and `ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED=1` and the Ollama provider is selected.
- One audio may be processed at a time to limit CPU/GPU pressure on ASUS. No microphone/camera request is involved. File size capped at 12 MB and decoded duration 90 s, timeout bounded.

## Pilot limitations and test
- End-to-end Whisper/Qwen latency and recognition accuracy for Mandarin have **not yet been physically tested on the owner's Windows ASUS**. CI certifies code/validation/build only.
- Test with a clearly recorded English or Mandarin message shorter than 30 s; confirm the original transcript matches spoken content and the translation retains BESS/PCS/SOC technical terms.
- Try the wrong source-language setting and confirm result is not incorrectly treated as language detection. Expect STT quality to fall; correct the selection.
- Check selection/removal of audio and that normal microphone buttons resume working when Translate is disabled.
- Longer voice notes, automatic splitting, language autodetection, bilingual TTS and live interpretation are future phases. STT-02 still compares alternative engines separately.

To roll back LT-05 without disabling text Translate, set `ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED=0` and restart the bridge. The pilot is branch-only; protected `main` is not merged.
