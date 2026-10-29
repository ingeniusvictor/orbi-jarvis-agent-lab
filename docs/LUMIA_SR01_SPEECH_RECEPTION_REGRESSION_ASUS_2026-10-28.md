# LUMIA SR-01 — Receive natural Spanish speech from two people in the same room

## Input evidence (owner 21:05–21:09, 2026-10-28)
13 STT segments were captured but there were severe lexical errors. The owner reported that even a second person speaking beside the laptop had to slow down and repeat. Examples: 'hacer una arriba' and 'repa venezolana' when the topic was likely arepa; mixed unintelligible fragments; one false '[Música]' during COMMAND. First Kokoro audio can begin in ~2s, so this is primarily an inbound Whisper/microphone issue rather than output TTS.

## Likely regression
NF-01 was enabled by default in the ASUS launch profile immediately before this report. It requested autoGainControl OFF and increased the wake and command VAD thresholds. With a laptop's omnidirectional mic and a second softer/sideways voice, either change can reduce audio onsets and unintentionally starve Whisper of input. The transcript alone cannot prove NF-01 caused every acoustic error, and there is no raw WAV recording to verify missing phonemes.

## SR-01 mitigation
- Disable VITE_LUMIA_NEAR_FIELD_FOCUS by default in the ASUS fast launcher (0). Chrome will again request AGC ON, echo cancellation ON and noise suppression ON. Original VAD sensitivity and timing return; wake-word and household echo/text guards stay intact.
- Retain NF-01 behind an explicit opt-in for future measured near-field studies; do not remove diagnostics or any existing feature.
- Add a *very narrow* Spanish local STT text repair for observed collocations 'hacer/preparar/cocinar una arriba/repa' -> '... una arepa' and 'repa venezolana/llanera' -> 'arepa ...'. Spatial 'arriba', other words, noise labels and technical vocabulary must not be altered. Applies to both local Whisper CLI and optionally persistent backend; no new service, API or audio recording.
- Keep LC-01 for long questions, Qwen, voice response, Kokoro and face GLB untouched.
- This is NOT general speech recognition improvement; an actual model upgrade/benchmark (Whisper small or more advanced local STT) may ultimately be needed for accented Spanish and mixed household audio. Nothing in CI proves acoustic effectiveness on Windows.

## Physical validation
Ask both speakers at their usual positions, first in a quiet room and then with normal low background noise. Say wake name, then ordinary full-speed conversational Spanish about several unrelated topics. Inspect D for actual AGC status and for mic RMS/threshold while speech happens. Verify both speakers' initial syllables arrive; compare punctuation and full phrase without slowing down. Repeat long-question LC-01 test. If recognition is still poor with AGC restored, verify Chrome's input device in site permissions and Windows Sound settings and consider a better/focused microphone; Whisper base limits remain.