"""Local Kokoro synthesis adapter for L.U.M.I.A.

The runtime and model assets live under .local-runtime/kokoro and are intentionally
not committed. This adapter performs no network access. It accepts one JSON
request on stdin and writes a PCM WAV file to the requested output path.
"""

import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import espeak
from misaki.espeak import EspeakG2P

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[3] / ".local-runtime" / "kokoro"
MODEL = ROOT / "models" / "kokoro-v1.0.onnx"
VOICES = ROOT / "models" / "voices-v1.0.bin"
MAX_TEXT = 4000

# Initialise the bundled eSpeak-ng fallback before Spanish G2P. This mirrors
# the certified kokoro-onnx Spanish path and keeps Windows independent of a
# separate system-wide eSpeak installation.
ESPEAK_FALLBACK = espeak.EspeakFallback(british=False)
G2P = EspeakG2P(language="es")


def main():
    try:
        request = json.loads(sys.stdin.read())
        text = request.get("text")
        output = request.get("outputPath")
        speaker = request.get("speaker") or "ef_dora"

        if (
            not isinstance(text, str)
            or not text.strip()
            or len(text) > MAX_TEXT
            or not isinstance(output, str)
        ):
            raise ValueError("VOICE_TTS_INVALID_TEXT")

        target = Path(output).resolve()
        if target.suffix.lower() != ".wav":
            raise ValueError("VOICE_TTS_FAILED")

        phonemes, _ = G2P(text.strip())
        if not phonemes.strip():
            raise ValueError("VOICE_TTS_INVALID_TEXT")

        kokoro = Kokoro(str(MODEL), str(VOICES))
        audio, sample_rate = kokoro.create(
            phonemes,
            speaker,
            is_phonemes=True,
        )
        sf.write(target, audio, sample_rate, subtype="PCM_16")

        print(
            json.dumps(
                {
                    "ok": True,
                    "sampleRate": sample_rate,
                    "voice": speaker,
                },
                ensure_ascii=False,
            )
        )
    except Exception as error:
        code = (
            str(error)
            if str(error).startswith("VOICE_TTS_")
            else "VOICE_TTS_FAILED"
        )
        print(
            json.dumps(
                {
                    "ok": False,
                    "errorCode": code,
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
