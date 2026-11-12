#!/usr/bin/env python3
"""VOICE-01K: CPU-only, opt-in CAM++ similarities for four PUBLIC Audio-3 clips.

No microphone, network, raw embedding output, audio output, disk writes, or
real-person identification. Uses fixed public WAV and pinned CAM++ model only.
This clip-level probe does NOT reproduce diarizer-internal embeddings/DER.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import sys
import time
from pathlib import Path

from voice01_listen import load_public_pcm

RATE = 16000
WAV_NAME = "3-two-speakers-en.wav"
WAV_SIZE = 1753804
WAV_SHA256 = "DD3CF2344F8410EE9A2E271E96D1C3F9B530F113AE5B47DEFECBC0D741A468E9"
MODEL_NAME = "3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx"
MODEL_SHA256 = "AA3CFC16963A10586A9393F5035D6D6B57E98D358B347F80C2A30BF4F00CEBA2"
CLIPS = (("A", 1.0, 6.0), ("B", 14.0, 20.0),
         ("C", 27.0, 30.0), ("D", 48.0, 53.0))
PAIRS = (("A", "B"), ("A", "C"), ("A", "D"),
         ("B", "C"), ("B", "D"), ("C", "D"))


class SimilarityError(ValueError):
    pass


def sha_matches(path: Path, size: int | None, sha256: str) -> bool:
    if not path.is_file() or (size is not None and path.stat().st_size != size):
        return False
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            h.update(block)
    return h.hexdigest().upper() == sha256


def cosine(first, second) -> float:
    if len(first) != len(second) or not first:
        raise SimilarityError("INVALID_VECTOR")
    x = [float(i) for i in first]
    y = [float(i) for i in second]
    if not all(math.isfinite(i) for i in x + y):
        raise SimilarityError("INVALID_VECTOR")
    dot = math.fsum(a * b for a, b in zip(x, y))
    norms = math.sqrt(math.fsum(a * a for a in x) *
                      math.fsum(b * b for b in y))
    if not math.isfinite(norms) or norms <= 0:
        raise SimilarityError("INVALID_VECTOR")
    score = dot / norms
    if not math.isfinite(score):
        raise SimilarityError("INVALID_VECTOR")
    return max(-1.0, min(1.0, score))


def pair_scores(vectors: dict) -> list[dict]:
    if set(vectors) != {"A", "B", "C", "D"}:
        raise SimilarityError("INVALID_CLIP_SET")
    return [{"pair": a + "-" + b, "cosine": round(cosine(vectors[a], vectors[b]), 5)}
            for a, b in PAIRS]


def extract_pair_scores(pcm: bytes, model: Path, *, backend=None, numpy=None):
    if backend is None:
        import sherpa_onnx as backend
    if numpy is None:
        import numpy as numpy
    cfg = backend.SpeakerEmbeddingExtractorConfig(
        model=str(model), num_threads=2, provider="cpu", debug=False
    )
    if not cfg.validate():
        raise SimilarityError("INVALID_MODEL")
    extractor = backend.SpeakerEmbeddingExtractor(cfg)
    values = numpy.frombuffer(pcm, dtype="<i2").astype(numpy.float32) / 32768.0
    embedded = {}
    for name, start, end in CLIPS:
        first, last = int(start * RATE), int(end * RATE)
        if first < 0 or last > len(values) or first >= last:
            raise SimilarityError("INVALID_CLIP_RANGE")
        stream = extractor.create_stream()
        stream.accept_waveform(sample_rate=RATE, waveform=values[first:last])
        stream.input_finished()
        if not extractor.is_ready(stream):
            raise SimilarityError("CLIP_NOT_READY")
        vector = extractor.compute(stream)
        if not vector:
            raise SimilarityError("INVALID_VECTOR")
        embedded[name] = vector
    return pair_scores(embedded)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="VOICE-01K public clip-level similarity")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--consent", action="store_true")
    args = parser.parse_args(argv)
    if args.doctor:
        print(json.dumps({
            "lab": "VOICE-01K", "mode": "doctor_no_inference",
            "sherpa_installed": importlib.util.find_spec("sherpa_onnx") is not None,
            "microphone_enabled": False, "network_enabled": False,
            "files_written": 0, "identity_confirmed": False,
        }))
        return 0
    try:
        if not args.consent:
            raise SimilarityError("CONSENT_REQUIRED")
        private = os.environ.get("LOCALAPPDATA")
        if not private:
            raise SimilarityError("WINDOWS_LOCAL_DATA_REQUIRED")
        base = Path(private) / "ORBI" / "LUMIA-VOICE-LAB"
        wav = base / "samples" / WAV_NAME
        model = base / "models" / MODEL_NAME
        if not sha_matches(wav, WAV_SIZE, WAV_SHA256):
            raise SimilarityError("PUBLIC_WAV_MISSING_OR_MISMATCH")
        if not sha_matches(model, None, MODEL_SHA256):
            raise SimilarityError("CAMPP_MODEL_MISSING_OR_MISMATCH")
        pcm, seconds = load_public_pcm(str(wav))
        if seconds < CLIPS[-1][2]:
            raise SimilarityError("INVALID_DURATION")
        started = time.perf_counter()
        pairs = extract_pair_scores(pcm, model)
        print(json.dumps({
            "lab": "VOICE-01K", "ok": True, "sample": WAV_NAME,
            "model": "CAM++", "probe": "four_fixed_clip_embeddings",
            "pairs": pairs,
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
            "clip_level_only": True, "equivalent_to_diarizer_internal": False,
            "speaker_identity_verified": False, "der_validated": False,
            "embedding_vectors_exported": False,
            "files_written": 0, "microphone_enabled": False,
            "network_enabled": False,
        }))
        return 0
    except (SimilarityError, OSError, ValueError, ImportError) as err:
        code = str(err) if isinstance(err, SimilarityError) else "LOCAL_MODEL_RUNTIME_ERROR"
    except Exception:
        code = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({"lab": "VOICE-01K", "ok": False, "error_code": code}),
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
