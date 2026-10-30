# UX-01 — Native multimodal input on ASUS

The three input modes are TEXT, PUSH (tap to start and tap to stop) and CONTINUOUS. Text is default only when the ASUS opt-in flag is on; other runtimes retain the original always-listening default. Image attachment uses the existing VI-01 one-image local Ollama capability; no webcam, paid API, tools, or writes are granted by changing input mode.

The microphone lease now supports explicit release, invalidating pending browser permission calls so a switch back to text cannot accidentally reactivate the device. Push capture is bounded at 20 seconds and posts a WAV to the same local Whisper endpoint. Longer speech remains a continuous-mode LC-01 feature. Release after push recording or when the owner selects TEXT; continuous voice is started only by explicit selection in the ASUS pilot.

Hardware tests (including Windows microphone privacy indicators, cross-mode racing and both household voices) are still needed. The existing Whisper and Kokoro pipeline remains unchanged.
