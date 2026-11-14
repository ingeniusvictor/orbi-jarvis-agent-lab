#!/usr/bin/env python3
"""VOICE-01N: anonymous reference/prediction support matrices for AMI.

No model tuning, new downloads, microphone, output files, speaker enrollment,
or raw voice vectors. Only optional local CPU inference on VOICE-01M's verified
AMI clip and reference, and aggregate anonymous speaker-seconds on stdout.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import voice01m_ami_benchmark as ami

DESCRIPTIVE_MIN_SUPPORT_SECONDS = 1.0


def _valid(reference, predicted, duration):
    if not math.isfinite(duration) or duration <= 0 or duration > ami.SECONDS:
        raise ami.BenchmarkError("INVALID_DURATION")
    ami.validate_segments(reference, max_duration=duration)
    ami.validate_segments(
        predicted, max_duration=duration,
        max_speakers=ami.MAX_AUTOMATIC_CLUSTERS,
    )
    if not reference:
        raise ami.BenchmarkError("EMPTY_REFERENCE")


def summarize_matrix(reference: list[tuple], predicted: list[tuple],
                     *, duration: float = ami.SECONDS) -> dict:
    """Sweep exact boundaries and count co-active speaker-seconds.

    The *unambiguous* matrix only uses intervals with exactly one manual
    speaker and one predicted group. The all-active matrix is supplementary;
    when there is overlap it may double-count wall-clock seconds.
    No Hungarian-style forced mapping and no cluster merging happen here.
    """
    _valid(reference, predicted, duration)
    refs = sorted({sp for _, _, sp in reference})
    preds = sorted({sp for _, _, sp in predicted})
    events = defaultdict(list)
    for kind, spans in (("r", reference), ("p", predicted)):
        for start, end, label in spans:
            events[start].append((kind, label, 1))
            events[end].append((kind, label, -1))
    boundaries = sorted(set([0.0, duration]) | set(events))
    active = {"r": defaultdict(int), "p": defaultdict(int)}
    clean = defaultdict(float)
    all_active = defaultdict(float)
    ref_seconds = defaultdict(float)
    predicted_seconds = defaultdict(float)
    ref_unmatched = defaultdict(float)
    pred_no_ref = defaultdict(float)
    ref_overlap_wallclock = 0.0
    both_unambiguous_wallclock = 0.0
    for at, end in zip(boundaries, boundaries[1:]):
        for kind, speaker, change in events[at]:
            active[kind][speaker] += change
            if active[kind][speaker] < 0:
                raise ami.BenchmarkError("INVALID_EVENT_ORDER")
        seconds = end - at
        if seconds <= 0:
            continue
        r = [sp for sp, n in active["r"].items() if n > 0]
        p = [sp for sp, n in active["p"].items() if n > 0]
        for sp in r:
            ref_seconds[sp] += seconds
            if not p:
                ref_unmatched[sp] += seconds
        for sp in p:
            predicted_seconds[sp] += seconds
            if not r:
                pred_no_ref[sp] += seconds
        if len(r) > 1:
            ref_overlap_wallclock += seconds
        if len(r) == 1 and len(p) == 1:
            clean[r[0], p[0]] += seconds
            both_unambiguous_wallclock += seconds
        for gold in r:
            for guess in p:
                all_active[gold, guess] += seconds

    matrix_clean = [
        {
            "reference": r,
            "reference_speaker_seconds": round(ref_seconds[r], 3),
            "uncovered_reference_seconds": round(ref_unmatched[r], 3),
            "unambiguous_support_seconds": round(
                sum(clean[r, p] for p in preds), 3),
            "seconds_by_predicted": [round(clean[r, p], 3) for p in preds],
        }
        for r in refs
    ]
    matrix_all = [
        {
            "reference": r,
            "seconds_by_predicted": [round(all_active[r, p], 3) for p in preds],
        }
        for r in refs
    ]
    predicted_details = []
    for p in preds:
        contributions = [(r, clean[r, p]) for r in refs]
        total = sum(value for _, value in contributions)
        best = max(contributions, key=lambda x: (x[1], x[0])) if contributions else None
        predicted_details.append({
            "group": p,
            "predicted_speaker_seconds": round(predicted_seconds[p], 3),
            "outside_manual_reference_seconds": round(pred_no_ref[p], 3),
            "unambiguous_support_seconds": round(total, 3),
            "dominant_reference": best[0] if best and best[1] > 0 else None,
            "dominant_share_of_unambiguous_support_pct":
                round(100 * best[1] / total, 2) if total > 0 else None,
        })

    reference_details = []
    for r in refs:
        ranked = sorted(
            [(p, clean[r, p]) for p in preds if clean[r, p] > 0],
            key=lambda x: (-x[1], x[0]),
        )
        total = sum(value for _, value in ranked)
        reference_details.append({
            "reference": r,
            "unambiguous_support_seconds": round(total, 3),
            "contributing_groups": len(ranked),
            "groups_with_at_least_1_second": sum(
                1 for _, secs in ranked if secs >= DESCRIPTIVE_MIN_SUPPORT_SECONDS),
            "top_group": ranked[0][0] if ranked else None,
            "top_group_share_pct": round(100 * ranked[0][1] / total, 2)
                                   if total else None,
            "group_support_descending": [
                {"group": p, "seconds": round(secs, 3)} for p, secs in ranked
            ],
        })
    return {
        "reference_labels": refs,
        "prediction_labels": preds,
        "reference_count": len(refs), "prediction_count": len(preds),
        "matrix_scope": "one_manual_one_predicted_only",
        "coactive_matrix_scope": "all_active_including_overlap_not_additive",
        "nonoverlap_matrix": matrix_clean,
        "coactive_matrix": matrix_all,
        "predicted_group_details": predicted_details,
        "reference_split_diagnostics": reference_details,
        "unambiguous_wallclock_seconds": round(both_unambiguous_wallclock, 3),
        "reference_overlap_wallclock_seconds": round(ref_overlap_wallclock, 3),
        "descriptive_group_support_min_seconds": DESCRIPTIVE_MIN_SUPPORT_SECONDS,
        "split_diagnosis_confirmed": False,
        "speaker_identity_verified": False,
    }


def run(base: Path, *, both: bool) -> dict:
    pcm, reference = ami.load_prepared(base)
    seg = base / "models" / ami.SEG_MODEL
    models = [("CAM++", base / "models" / ami.MODEL_NAME)]
    if both:
        models.append(("ERes2Net", base / "models" / ami.ERES_MODEL))
    if not seg.is_file():
        raise ami.BenchmarkError("SEGMENTATION_MODEL_MISSING")
    if not ami.sha_matches(models[0][1], None, ami.MODEL_SHA256):
        raise ami.BenchmarkError("CAMPP_MODEL_MISMATCH")
    if any(not model.is_file() for _, model in models):
        raise ami.BenchmarkError("EMBEDDING_MODEL_MISSING")
    outputs = []
    for name, path in models:
        started = time.perf_counter()
        segments, groups = ami.voice.diarize(
            pcm, str(seg), str(path), -1, cluster_threshold=0.5,
        )
        predicted = [
            (turn["start"], turn["end"], turn["speaker"])
            for turn in segments
        ]
        # Re-run same interval scorer as VOICE-01M, so the inference can be
        # compared with the prior physical benchmark without exporting spans.
        score = ami.score_intervals(reference, predicted)
        analysis = summarize_matrix(reference, predicted)
        if groups != analysis["prediction_count"]:
            raise ami.BenchmarkError("INCONSISTENT_AUTOMATIC_COUNT")
        outputs.append({
            "model": name, "threshold": 0.5,
            "auto_speaker_count": groups,
            "segments": len(segments),
            "cpu_elapsed_ms": round((time.perf_counter() - started) * 1000),
            "der_like_error_percent": score["error_percent"],
            "der_like_not_official": True,
            **analysis,
        })
    return {
        "lab": "VOICE-01N", "ok": True,
        "mode": "offline_anonymous_support_matrix",
        "corpus": "AMI", "clip_seconds": ami.SECONDS,
        "reference_type": "existing_ami_manual_only_words",
        "models": outputs, "source_audio_reused": True,
        "new_downloads": 0, "files_written": 0,
        "microphone_enabled": False, "network_enabled": False,
        "raw_predictions_exported": False, "embedding_vectors_exported": False,
        "equivalent_to_official_DER": False,
        "generalization_validated": False,
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="VOICE-01N anonymous AMI support matrix")
    choices = p.add_mutually_exclusive_group()
    choices.add_argument("--doctor", action="store_true")
    choices.add_argument("--run", action="store_true")
    p.add_argument("--consent", action="store_true")
    p.add_argument("--compare", action="store_true")
    args = p.parse_args(argv)
    if args.doctor:
        local = os.environ.get("LOCALAPPDATA")
        exists = bool(local and all(path.is_file() for path in ami.locations(
            Path(local) / "ORBI" / "LUMIA-VOICE-LAB")))
        print(json.dumps({
            "lab": "VOICE-01N", "mode": "doctor_no_inference",
            "prepared_files_present": exists,
            "models": ["CAM++", "ERes2Net"] if args.compare else ["CAM++"],
            "microphone_enabled": False, "network_enabled": False,
            "files_written": 0,
        }))
        return 0
    try:
        if not args.consent:
            raise ami.BenchmarkError("CONSENT_REQUIRED")
        if not args.run:
            raise ami.BenchmarkError("RUN_REQUIRED")
        local = os.environ.get("LOCALAPPDATA")
        if not local:
            raise ami.BenchmarkError("LOCALAPPDATA_REQUIRED")
        base = Path(local) / "ORBI" / "LUMIA-VOICE-LAB"
        print(json.dumps(run(base, both=args.compare), ensure_ascii=False))
        return 0
    except ami.BenchmarkError as err:
        error_code = str(err)
    except (OSError, ValueError, ImportError):
        error_code = "LOCAL_MODEL_RUNTIME_ERROR"
    except Exception:
        error_code = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({
        "lab": "VOICE-01N", "ok": False, "error_code": error_code,
    }), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
