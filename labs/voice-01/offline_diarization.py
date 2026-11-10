#!/usr/bin/env python3
"""LUMIA VOICE-01: voluntary offline speaker segmentation.

No microphone, no automatic downloads, no data persistence, no identity matching.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import sys
import time
import wave
from pathlib import Path

RATE = 16000
MAX_SECONDS = 600


class LabError(Exception):
    pass


def read_pcm16_mono(path: str) -> tuple[bytes, float]:
    try:
        p = Path(path)
        if not p.is_file() or p.stat().st_size > 25_000_000:
            raise LabError("INVALID_WAV")
        with wave.open(str(p), "rb") as wav:
            if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(),
                    wav.getcomptype()) != (1, 2, RATE, "NONE"):
                raise LabError("UNSUPPORTED_WAV_FORMAT")
            n = wav.getnframes()
            if not 0 < n <= RATE * MAX_SECONDS:
                raise LabError("INVALID_DURATION")
            data = wav.readframes(n)
            if len(data) != n * 2:
                raise LabError("INCOMPLETE_WAV")
            return data, n / RATE
    except LabError:
        raise
    except (OSError, EOFError, ValueError, wave.Error):
        raise LabError("INVALID_WAV") from None


def diarize(pcm16: bytes, segmentation: str, embeddings: str,
            num_speakers: int = -1, backend=None, numpy_module=None,
            *, cluster_threshold: float = 0.5):
    if (not math.isfinite(cluster_threshold) or
            not 0.0 < cluster_threshold < 1.0):
        raise LabError("INVALID_CLUSTER_THRESHOLD")
    if backend is None:
        try:
            import sherpa_onnx as backend
        except ImportError:
            raise LabError("SHERPA_NOT_INSTALLED") from None
    if numpy_module is None:
        try:
            import numpy as numpy_module
        except ImportError:
            raise LabError("NUMPY_NOT_INSTALLED") from None
    cfg = backend.OfflineSpeakerDiarizationConfig(
        segmentation=backend.OfflineSpeakerSegmentationModelConfig(
            pyannote=backend.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=segmentation, window_shift_ratio=0.1,
            ),
        ),
        embedding=backend.SpeakerEmbeddingExtractorConfig(model=embeddings),
        clustering=backend.FastClusteringConfig(
            num_clusters=num_speakers, threshold=cluster_threshold,
        ),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not cfg.validate():
        raise LabError("INVALID_MODELS")
    sd = backend.OfflineSpeakerDiarization(cfg)
    if sd.sample_rate != RATE:
        raise LabError("WRONG_MODEL_SAMPLE_RATE")
    samples = numpy_module.frombuffer(pcm16, dtype="<i2").astype(
        numpy_module.float32
    ) / 32768.0
    result = sd.process(samples).sort_by_start_time()
    mapped = {}
    segments = []
    for segment in result:
        start, end = float(segment.start), float(segment.end)
        if not all(map(math.isfinite, (start, end))) or start < 0 or end <= start:
            raise LabError("INVALID_SEGMENT")
        original = int(segment.speaker)
        if original not in mapped:
            mapped[original] = "speaker_" + str(len(mapped))
        segments.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "speaker": mapped[original],
        })
    return segments, len(mapped)


def main(argv=None):
    p = argparse.ArgumentParser(description="LUMIA VOICE-01 offline CPU research")
    p.add_argument("--doctor", action="store_true")
    p.add_argument("--wav")
    p.add_argument("--segmentation-model")
    p.add_argument("--embedding-model")
    p.add_argument("--num-speakers", type=int, default=-1)
    p.add_argument("--cluster-threshold", type=float, default=0.5,
                   help="Auto-clustering similarity threshold: higher tends to merge more speakers; default 0.5")
    p.add_argument("--consent", action="store_true")
    args = p.parse_args(argv)
    if args.doctor:
        print(json.dumps({
            "lab": "VOICE-01",
            "sherpa_installed": importlib.util.find_spec("sherpa_onnx") is not None,
            "microphone_enabled": False,
            "recognition_enabled_in_lumia": False,
        }))
        return 0
    try:
        if not args.consent:
            raise LabError("CONSENT_REQUIRED")
        if not all((args.wav, args.segmentation_model, args.embedding_model)):
            raise LabError("MISSING_INPUT")
        if args.num_speakers not in (-1, 1, 2, 3, 4):
            raise LabError("INVALID_SPEAKER_COUNT")
        if (not math.isfinite(args.cluster_threshold) or
                not 0.0 < args.cluster_threshold < 1.0):
            raise LabError("INVALID_CLUSTER_THRESHOLD")
        if not (Path(args.segmentation_model).is_file() and
                Path(args.embedding_model).is_file()):
            raise LabError("MODELS_NOT_FOUND")
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
        samples, duration = read_pcm16_mono(args.wav)
        started = time.perf_counter()
        turns, count = diarize(
            samples, args.segmentation_model,
            args.embedding_model, args.num_speakers,
            cluster_threshold=args.cluster_threshold,
        )
        print(json.dumps({
            "lab": "VOICE-01", "ok": True, "mode": "offline-cpu-file",
            "duration_s": round(duration, 3),
            "num_speakers_requested": args.num_speakers,
            "cluster_threshold": args.cluster_threshold,
            "speaker_count": count,
            "segment_count": len(turns),
            "segments": turns,
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
            "files_written": 0,
            "identity_confirmed": False,
            "recognition_enabled_in_lumia": False,
        }, ensure_ascii=False))
        return 0
    except LabError as exc:
        code = str(exc)
    except Exception:
        code = "MODEL_RUNTIME_ERROR"
    # Protect paths, user names, original speech and model stack traces.
    print(json.dumps({
        "lab": "VOICE-01", "ok": False,
        "error_code": code,
        "hint": "Revisa localmente audio, modelos y consentimiento.",
    }, ensure_ascii=False), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
