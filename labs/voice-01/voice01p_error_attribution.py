#!/usr/bin/env python3
"""VOICE-01P: descriptive final-output diarization error attribution, offline.

Uses the TWO existing publicly prepared/checksummed AMI clips. Does NOT claim
to isolate internal segmentation vs embedding/clustering failures: only the
final model output is available. No audio, RTTM, embeddings, turns or raw
per-speaker event timelines are written or exported.
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
import voice01n_reference_matrix as matrix
import voice01o_second_meeting as other

MIN_DESCRIPTIVE_SUPPORT_S = 1.0
MEETINGS = ("ES2002a", "ES2003a")
REGIONS = ("reference_silence", "single_reference", "overlap_reference")


def _s(value: float) -> float:
    """Round descriptive seconds, not input frames or scorer values."""
    return round(value, 3)


def _optimal_one_to_one(weights, refs, preds):
    """Exact max-weight global scoring alignment, NOT an identity assertion.

    At most four reference speakers so the DP is O(predictions * 2**4 * 4),
    rather than enumerating permutations of all predicted clusters.
    """
    states = {0: (0.0, ())}
    for predicted in preds:
        updated = dict(states)  # predicted group can stay unmatched
        for mask, (score, matches) in states.items():
            for index, reference in enumerate(refs):
                bit = 1 << index
                if mask & bit:
                    continue
                new_mask = mask | bit
                candidate = score + weights.get((reference, predicted), 0.0)
                current = updated.get(new_mask)
                if current is None or candidate > current[0] + 1e-10:
                    updated[new_mask] = (
                        candidate, matches + ((predicted, reference),)
                    )
        states = updated
    return dict(max(states.values(), key=lambda value: value[0])[1])


def _empty_bucket():
    return dict(
        wallclock_seconds=0.0,
        reference_speaker_seconds=0.0,
        predicted_speaker_seconds=0.0,
        miss_speaker_seconds=0.0,
        false_alarm_speaker_seconds=0.0,
        confusion_speaker_seconds=0.0,
        reference_speech_not_predicted_wallclock_seconds=0.0,
        prediction_without_reference_wallclock_seconds=0.0,
    )


def _timeline(reference, prediction, duration):
    ami.validate_segments(reference, max_duration=duration)
    ami.validate_segments(
        prediction, max_duration=duration,
        max_speakers=ami.MAX_AUTOMATIC_CLUSTERS,
    )
    if not reference:
        raise ami.BenchmarkError("EMPTY_REFERENCE")
    if not math.isfinite(duration) or duration <= 0 or duration > ami.SECONDS:
        raise ami.BenchmarkError("INVALID_DURATION")

    events = defaultdict(list)
    for kind, segments in (("r", reference), ("p", prediction)):
        for start, end, label in segments:
            events[start].append((kind, label, +1))
            events[end].append((kind, label, -1))
    points = sorted(set([0.0, duration]) | set(events))
    active = {"r": defaultdict(int), "p": defaultdict(int)}
    intervals = []
    weights = defaultdict(float)
    for at, end in zip(points, points[1:]):
        for kind, label, delta in events[at]:
            active[kind][label] += delta
            if active[kind][label] < 0:
                raise ami.BenchmarkError("INVALID_EVENT_ORDER")
        r = frozenset(label for label, count in active["r"].items() if count)
        p = frozenset(label for label, count in active["p"].items() if count)
        dt = end - at
        if dt <= 0:
            continue
        intervals.append((dt, r, p))  # RAM only; never print or write turns.
        for actual in r:
            for predicted in p:
                weights[actual, predicted] += dt

    refs = sorted({label for _, _, label in reference})
    preds = sorted({label for _, _, label in prediction})
    alignment = _optimal_one_to_one(weights, refs, preds)
    buckets = {key: _empty_bucket() for key in REGIONS}
    overlap_ref_detected_wallclock = 0.0
    overlap_ref_single_pred_wallclock = 0.0

    for dt, r, p in intervals:
        region = ("reference_silence" if not r else
                  "single_reference" if len(r) == 1 else
                  "overlap_reference")
        b = buckets[region]
        b["wallclock_seconds"] += dt
        b["reference_speaker_seconds"] += len(r) * dt
        b["predicted_speaker_seconds"] += len(p) * dt
        b["miss_speaker_seconds"] += max(len(r) - len(p), 0) * dt
        b["false_alarm_speaker_seconds"] += max(len(p) - len(r), 0) * dt
        correctly_associated = sum(
            1 for predicted in p if alignment.get(predicted) in r
        )
        b["confusion_speaker_seconds"] += (
            min(len(r), len(p)) - correctly_associated
        ) * dt
        if r and not p:
            b["reference_speech_not_predicted_wallclock_seconds"] += dt
        if p and not r:
            b["prediction_without_reference_wallclock_seconds"] += dt
        if len(r) >= 2 and len(p) >= 2:
            overlap_ref_detected_wallclock += dt
        if len(r) >= 2 and len(p) == 1:
            overlap_ref_single_pred_wallclock += dt

    score = ami.score_intervals(reference, prediction, duration=duration)
    for metric, key in (
        ("miss_seconds", "miss_speaker_seconds"),
        ("false_alarm_seconds", "false_alarm_speaker_seconds"),
        ("confusion_seconds", "confusion_speaker_seconds"),
    ):
        observed = sum(b[key] for b in buckets.values())
        if abs(observed - score[metric]) > 0.001:
            raise ami.BenchmarkError("SCORER_DIAGNOSTIC_MISMATCH")
    if abs(sum(b["reference_speaker_seconds"] for b in buckets.values())
           - score["reference_speaker_seconds"]) > 0.001:
        raise ami.BenchmarkError("SCORER_REFERENCE_MISMATCH")

    return {
        "regions": {
            region: {name: _s(value) for name, value in bucket.items()}
            for region, bucket in buckets.items()
        },
        "reference_overlap_wallclock_seconds": _s(
            buckets["overlap_reference"]["wallclock_seconds"]),
        "reference_overlap_with_at_least_two_predicted_wallclock_seconds":
            _s(overlap_ref_detected_wallclock),
        "reference_overlap_with_only_one_predicted_wallclock_seconds":
            _s(overlap_ref_single_pred_wallclock),
        "scorer_consistency_verified": True,
        "score": score,
    }


def describe(reference: list[tuple], prediction: list[tuple],
             *, duration: float = ami.SECONDS):
    """No threshold is applied to inference; 1 s is descriptive support only."""
    detailed = matrix.summarize_matrix(
        reference, prediction, duration=duration,
    )
    timeline = _timeline(reference, prediction, duration)
    support = detailed["nonoverlap_matrix"]
    predicted_ids = detailed["prediction_labels"]

    split_candidates = []
    for row in support:
        important = [
            {"group": group, "unambiguous_support_seconds": _s(seconds)}
            for group, seconds in zip(
                predicted_ids, row["seconds_by_predicted"])
            if seconds >= MIN_DESCRIPTIVE_SUPPORT_S
        ]
        if len(important) > 1:
            split_candidates.append({
                "reference": row["reference"],
                "supported_predicted_groups": important,
                "distinct_groups_with_at_least_1s": len(important),
            })

    mixed_groups = []
    for idx, predicted in enumerate(predicted_ids):
        important = [
            {"reference": row["reference"],
             "unambiguous_support_seconds": _s(
                 row["seconds_by_predicted"][idx])}
            for row in support
            if row["seconds_by_predicted"][idx] >= MIN_DESCRIPTIVE_SUPPORT_S
        ]
        if len(important) > 1:
            mixed_groups.append({
                "group": predicted,
                "supported_references": important,
                "distinct_references_with_at_least_1s": len(important),
            })

    zero_one_to_one_support = [
        {
            "group": row["group"],
            "predicted_speaker_seconds": row["predicted_speaker_seconds"],
            "outside_manual_reference_seconds":
                row["outside_manual_reference_seconds"],
        }
        for row in detailed["predicted_group_details"]
        if row["predicted_speaker_seconds"] >= MIN_DESCRIPTIVE_SUPPORT_S
        and row["unambiguous_support_seconds"] == 0.0
    ]
    return {
        "reference_speakers": detailed["reference_count"],
        "automatic_speaker_groups": detailed["prediction_count"],
        "der_like_error_percent": timeline["score"]["error_percent"],
        "total_miss_speaker_seconds": timeline["score"]["miss_seconds"],
        "total_false_alarm_speaker_seconds":
            timeline["score"]["false_alarm_seconds"],
        "total_confusion_speaker_seconds":
            timeline["score"]["confusion_seconds"],
        "reference_speaker_seconds":
            timeline["score"]["reference_speaker_seconds"],
        "error_by_reference_activity": timeline["regions"],
        "reference_overlap_wallclock_seconds":
            timeline["reference_overlap_wallclock_seconds"],
        "overlap_reference_predicted_multiplicity": {
            "at_least_two_predicted_wallclock_seconds": timeline[
                "reference_overlap_with_at_least_two_predicted_wallclock_seconds"],
            "only_one_predicted_wallclock_seconds": timeline[
                "reference_overlap_with_only_one_predicted_wallclock_seconds"],
        },
        "split_candidates": split_candidates,
        "mixed_predicted_groups": mixed_groups,
        "groups_without_unambiguous_support": zero_one_to_one_support,
        "descriptive_support_threshold_seconds": MIN_DESCRIPTIVE_SUPPORT_S,
        "scorer_consistency_verified": timeline["scorer_consistency_verified"],
        "internal_segmentation_causally_diagnosed": False,
        "speaker_identity_verified": False,
    }


def run(base: Path, meeting_names: tuple[str, ...], *, compare: bool):
    """Run each requested meeting and each model; no download or files written."""
    model_names = [("CAM++", base / "models" / ami.MODEL_NAME)]
    if compare:
        model_names.append(("ERes2Net", base / "models" / ami.ERES_MODEL))
    segmentation = base / "models" / ami.SEG_MODEL
    if not segmentation.is_file():
        raise ami.BenchmarkError("SEGMENTATION_MODEL_MISSING")
    if not ami.sha_matches(model_names[0][1], None, ami.MODEL_SHA256):
        raise ami.BenchmarkError("CAMPP_MODEL_MISMATCH")
    if any(not model.is_file() for _, model in model_names):
        raise ami.BenchmarkError("EMBEDDING_MODEL_MISSING")

    # Verify every chosen corpus and annotation SHA before performing inference.
    corpora = []
    for meeting in meeting_names:
        if meeting == "ES2002a":
            audio, manual = ami.load_prepared(base)
        elif meeting == "ES2003a":
            audio, manual = other.load_prepared(base)
        else:
            raise ami.BenchmarkError("UNSUPPORTED_MEETING")
        corpora.append((meeting, audio, manual))

    outputs = []
    for meeting, audio, reference in corpora:
        model_outputs = []
        for name, model in model_names:
            start = time.perf_counter()
            segments, count = ami.voice.diarize(
                audio, str(segmentation), str(model), -1,
                cluster_threshold=0.5,
            )
            predictions = [
                (item["start"], item["end"], item["speaker"])
                for item in segments
            ]
            analysis = describe(reference, predictions, duration=100.0)
            if count != analysis["automatic_speaker_groups"]:
                raise ami.BenchmarkError("INCONSISTENT_AUTOMATIC_COUNT")
            model_outputs.append({
                "model": name, "threshold": 0.5,
                "automatic_speaker_count_unforced": count,
                "segments": len(segments),
                "cpu_elapsed_ms": round(
                    (time.perf_counter() - start) * 1000),
                **analysis,
            })
        outputs.append({
            "meeting": meeting, "clip_seconds": 100.0,
            "models": model_outputs,
        })
    return {
        "lab": "VOICE-01P", "ok": True,
        "mode": "offline_final_output_error_anatomy",
        "reference_type": "AMI_public_manual_only_words",
        "meetings": outputs, "threshold": 0.5,
        "num_speakers": "automatic_not_forced",
        "model_internal_stages_instrumented": False,
        "segmentation_clustering_causal_attribution": False,
        "official_DER": False,
        "new_downloads": 0, "files_written": 0,
        "microphone_enabled": False, "network_enabled": False,
        "audio_exported": False, "raw_turns_exported": False,
        "embeddings_exported": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="VOICE-01P diagnostic of final diarizer outputs")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--consent", action="store_true")
    parser.add_argument("--compare", action="store_true")
    parser.add_argument(
        "--meeting", default="both",
        choices=("both", "ES2002a", "ES2003a"),
    )
    args = parser.parse_args(argv)
    if args.doctor:
        local = os.environ.get("LOCALAPPDATA")
        base = Path(local) / "ORBI" / "LUMIA-VOICE-LAB" if local else None
        availability = {
            "ES2002a": bool(base and all(
                p.is_file() for p in ami.locations(base))),
            "ES2003a": bool(base and all(
                p.is_file() for p in other.paths(base))),
        }
        print(json.dumps({
            "lab": "VOICE-01P", "mode": "doctor_no_inference",
            "prepared_corpora_present": availability,
            "microphone_enabled": False,
            "network_enabled": False, "files_written": 0,
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
        selected = MEETINGS if args.meeting == "both" else (args.meeting,)
        print(json.dumps(run(base, selected, compare=args.compare)))
        return 0
    except ami.BenchmarkError as exc:
        error = str(exc)
    except (OSError, ValueError, ImportError, UnicodeError):
        error = "LOCAL_MODEL_RUNTIME_ERROR"
    except Exception:
        error = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({
        "lab": "VOICE-01P", "ok": False, "error_code": error,
    }), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
