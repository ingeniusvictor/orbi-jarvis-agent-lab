"""Opt-in VA-01 L.U.M.I.A. Kokoro resident worker.

Line-delimited JSON over stdin/stdout. Keeps Kokoro ONNX model and Spanish
phonemizer in one local Python process for the entire assistant session.
No TCP port, network requests, audio retention or remote provider.
The original synthesize.py one-shot adapter remains unchanged.
"""

import json
import os
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
MODEL = Path(os.environ.get("ORBI_LOCAL_TTS_MODEL") or ROOT / "models" / "kokoro-v1.0.onnx")
VOICES = Path(os.environ.get("ORBI_LOCAL_TTS_VOICES") or ROOT / "models" / "voices-v1.0.bin")
MAX_TEXT = 4000


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    try:
        espeak.EspeakFallback(british=False)
        g2p = EspeakG2P(language="es")
        tts = Kokoro(str(MODEL), str(VOICES))
    except Exception:
        emit({"ready": False, "errorCode": "VOICE_TTS_UNAVAILABLE"})
        return 1

    emit({"ready": True})

    for raw in sys.stdin:
        try:
            request = json.loads(raw)
            job_id = request.get("id")
            text = request.get("text")
            target_path = request.get("outputPath")
            speaker = request.get("speaker") or "ef_dora"
            if (
                not isinstance(job_id, int)
                or not isinstance(text, str)
                or not text.strip()
                or len(text) > MAX_TEXT
                or not isinstance(target_path, str)
                or not isinstance(speaker, str)
            ):
                raise ValueError("VOICE_TTS_INVALID_TEXT")
            target = Path(target_path).resolve()
            if target.suffix.lower() != ".wav":
                raise ValueError("VOICE_TTS_INVALID_TEXT")

            phonemes, _ = g2p(text.strip())
            if not phonemes or not phonemes.strip():
                raise ValueError("VOICE_TTS_INVALID_TEXT")
            audio, sample_rate = tts.create(phonemes, speaker, is_phonemes=True)
            sf.write(target, audio, sample_rate, subtype="PCM_16")
            emit({"id": job_id, "ok": True})
        except Exception as exc:
            code = str(exc)
            if not code.startswith("VOICE_TTS_"):
                code = "VOICE_TTS_FAILED"
            emit({"id": job_id if "job_id" in locals() else None, "ok": False, "errorCode": code})

    return 0


if __name__ == "__main__":
    sys.exit(main())
