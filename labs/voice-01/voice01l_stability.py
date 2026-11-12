#!/usr/bin/env python3
"""VOICE-01L: repeatable multi-window CAM++ stability probe on one PUBLIC WAV.

CPU only, explicit opt-in. Does not record, transmit or persist speech, audio,
embedding vectors or other files. Similarity is NOT identity, RTTM or DER.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import sys
import time
from pathlib import Path

from voice01_listen import load_public_pcm
from voice01k_similarity import (
    CLIPS, MODEL_NAME, MODEL_SHA256, PAIRS, RATE, WAV_NAME, WAV_SHA256,
    WAV_SIZE, SimilarityError, cosine, sha_matches,
)

# Two NON-OVERLAPPING 1.5-second windows per original reference clip.
# They are deterministic and do not depend on a local ASR transcript.
# Actual vocal activity has NOT yet been independently checked.
WINDOWS = (
    ("A1", "A", 1.0, 2.5),
    ("A2", "A", 4.0, 5.5),
    ("B1", "B", 14.0, 15.5),
    ("B2", "B", 18.5, 20.0),
    ("C1", "C", 27.0, 28.5),
    ("C2", "C", 28.5, 30.0),
    ("D1", "D", 48.0, 49.5),
    ("D2", "D", 51.0, 52.5),
)
WINDOW_DURATION_S = 1.5


def validate_windows(windows=WINDOWS) -> tuple[tuple, ...]:
    if len(windows) != 8:
        raise SimilarityError("INVALID_WINDOW_PLAN")
    expected_labels = {g + str(i) for g in "ABCD" for i in (1, 2)}
    if {item[0] for item in windows} != expected_labels:
        raise SimilarityError("INVALID_WINDOW_PLAN")
    clip_bounds = {name: (start, end) for name, start, end in CLIPS}
    grouped = {group: [] for group in "ABCD"}
    for name, group, start, end in windows:
        if name not in (group + "1", group + "2") or group not in grouped:
            raise SimilarityError("INVALID_WINDOW_PLAN")
        if not all(math.isfinite(x) for x in (start, end)):
            raise SimilarityError("INVALID_WINDOW_PLAN")
        a, b = clip_bounds[group]
        if (start < a or end > b or
                abs((end - start) - WINDOW_DURATION_S) > 1e-8):
            raise SimilarityError("INVALID_WINDOW_PLAN")
        grouped[group].append((start, end))
    for group in grouped:
        ranges = sorted(grouped[group])
        if len(ranges) != 2 or ranges[0][1] > ranges[1][0]:
            raise SimilarityError("INVALID_WINDOW_PLAN")
    return tuple(windows)


def aggregate_scores(vectors: dict) -> dict:
    """Return scores only; never serialize raw embedding vectors."""
    validate_windows()
    if set(vectors) != {name for name, _, _, _ in WINDOWS}:
        raise SimilarityError("INVALID_WINDOW_SET")

    within = []
    for group in "ABCD":
        score = cosine(vectors[group + "1"], vectors[group + "2"])
        within.append({"group": group, "cosine": round(score, 5)})

    between = []
    raw_means = {}
    raw_min = {}
    raw_max = {}
    for left, right in PAIRS:
        results = [
            (a, b, cosine(vectors[a], vectors[b]))
            for a in (left + "1", left + "2")
            for b in (right + "1", right + "2")
        ]
        values = [score for _, _, score in results]
        name = left + "-" + right
        raw_means[name] = math.fsum(values) / len(values)
        raw_min[name], raw_max[name] = min(values), max(values)
        between.append({
            "pair": name, "mean": round(raw_means[name], 5),
            "min": round(raw_min[name], 5),
            "max": round(raw_max[name], 5),
            "window_pairs": [
                {"windows": a + "-" + b, "cosine": round(score, 5)}
                for a, b, score in results
            ],
        })
    comparisons = {
        "mean_ac_minus_ab": round(raw_means["A-C"] - raw_means["A-B"], 5),
        "mean_ad_minus_ab": round(raw_means["A-D"] - raw_means["A-B"], 5),
        "worst_ac_minus_best_ab": round(
            raw_min["A-C"] - raw_max["A-B"], 5),
        "worst_ad_minus_best_ab": round(
            raw_min["A-D"] - raw_max["A-B"], 5),
    }
    return {"within": within, "between": between, "comparisons": comparisons}


def run_probe(pcm: bytes, model: Path, *, backend=None, numpy_module=None) -> dict:
    validate_windows()
    if backend is None:
        import sherpa_onnx as backend
    if numpy_module is None:
        import numpy as numpy_module
    cfg = backend.SpeakerEmbeddingExtractorConfig(
        model=str(model), num_threads=2, provider="cpu", debug=False,
    )
    if not cfg.validate():
        raise SimilarityError("INVALID_MODEL")
    extractor = backend.SpeakerEmbeddingExtractor(cfg)
    samples = numpy_module.frombuffer(pcm, dtype="<i2").astype(
        numpy_module.float32
    ) / 32768.0
    vectors = {}
    levels = []
    for name, group, start, end in WINDOWS:
        first = round(start * RATE)
        last = round(end * RATE)
        if first < 0 or last > len(samples) or last <= first:
            raise SimilarityError("INVALID_WINDOW_RANGE")
        excerpt = samples[first:last]
        # RMS is a coarse level check, not VAD or a proof of audible speech.
        rms = float(numpy_module.sqrt(numpy_module.mean(excerpt * excerpt)))
        if not math.isfinite(rms) or rms < 0:
            raise SimilarityError("INVALID_SIGNAL_LEVEL")
        levels.append({
            "window": name, "start_s": start, "end_s": end,
            "rms_dbfs": round(20 * math.log10(max(rms, 1e-6)), 2),
        })
        stream = extractor.create_stream()
        stream.accept_waveform(sample_rate=RATE, waveform=excerpt)
        stream.input_finished()
        if not extractor.is_ready(stream):
            raise SimilarityError("WINDOW_NOT_READY")
        vector = extractor.compute(stream)
        if vector is None or len(vector) == 0:
            raise SimilarityError("INVALID_VECTOR")
        vectors[name] = vector
    summary = aggregate_scores(vectors)
    summary["windows"] = levels
    return summary


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="VOICE-01L offline window stability")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--consent", action="store_true")
    args = parser.parse_args(argv)
    if args.doctor:
        print(json.dumps({
            "lab": "VOICE-01L", "mode": "doctor_no_inference",
            "window_count": len(WINDOWS),
            "equal_window_seconds": WINDOW_DURATION_S,
            "sherpa_installed": importlib.util.find_spec("sherpa_onnx") is not None,
            "microphone_enabled": False, "network_enabled": False,
            "files_written": 0,
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
        pcm, duration = load_public_pcm(str(wav))
        if duration < max(end for _, _, _, end in WINDOWS):
            raise SimilarityError("INVALID_DURATION")
        started = time.perf_counter()
        summary = run_probe(pcm, model)
        print(json.dumps({
            "lab": "VOICE-01L", "ok": True,
            "sample": WAV_NAME, "model": "CAM++",
            "probe": "two_equal_nonoverlapping_windows_per_clip",
            "window_seconds": WINDOW_DURATION_S,
            **summary,
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
            "exploratory_only": True,
            "windows_audibly_checked": False,
            "equivalent_to_diarizer_internal": False,
            "speaker_identity_verified": False, "der_validated": False,
            "embedding_vectors_exported": False,
            "files_written": 0, "microphone_enabled": False,
            "network_enabled": False,
        }, ensure_ascii=False))
        return 0
    except (SimilarityError, OSError, ValueError, ImportError) as err:
        code = str(err) if isinstance(err, SimilarityError) else "LOCAL_MODEL_RUNTIME_ERROR"
    except Exception:
        code = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({"lab": "VOICE-01L", "ok": False, "error_code": code}),
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
