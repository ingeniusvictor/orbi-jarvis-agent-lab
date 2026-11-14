#!/usr/bin/env python3
"""LUMIA VOICE-00: synthetic-friendly anonymous RTTM comparison.

Conservative 10ms frame-error proxy, NOT official DER:
exclude overlapped reference speech and do not apply a collar.
No audio or personal names are read; no files are written.
"""
from __future__ import annotations
import argparse
import itertools
import json
import math
import sys
from pathlib import Path

FRAME = 0.01
MAX_SECONDS = 600.0


class MetricError(Exception):
    pass


def parse_rttm(text: str, *, allow_empty: bool = False):
    segments = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) < 8 or fields[0] != "SPEAKER":
            raise MetricError("INVALID_RTTM")
        try:
            start, duration = float(fields[3]), float(fields[4])
        except ValueError:
            raise MetricError("INVALID_RTTM") from None
        if (not math.isfinite(start) or not math.isfinite(duration) or
                start < 0 or duration <= 0 or start + duration > MAX_SECONDS):
            raise MetricError("INVALID_RTTM")
        segments.append((start, start + duration, fields[7]))
    if not segments and not allow_empty:
        raise MetricError("EMPTY_RTTM")
    if len({sp for _, _, sp in segments}) > 4:
        raise MetricError("TOO_MANY_SPEAKERS")
    return segments


def labels_per_frame(segments, count: int):
    labels = [set() for _ in range(count)]
    for start, end, speaker in segments:
        begin = max(0, int(start / FRAME))
        stop = min(count, math.ceil(end / FRAME))
        for i in range(begin, stop):
            if start <= (i + 0.5) * FRAME < end:
                labels[i].add(speaker)
    return labels


def assess(reference, prediction):
    """Score fixed 10-ms frames once, then optimize speaker-ID permutation.

    Avoid factorial * frame-count loops on 10-minute CPU recordings.
    """
    duration = max(end for _, end, _ in reference + prediction)
    n = math.ceil(duration / FRAME)
    expected = labels_per_frame(reference, n)
    observed = labels_per_frame(prediction, n)
    real_ids = sorted({s for _, _, s in reference})
    predicted_ids = sorted({s for _, _, s in prediction})
    pair_counts = {}
    miss = false_alarm = multi_pred = scored = overlap_skipped = single_pairs = 0
    for gold, hyp in zip(expected, observed):
        if len(gold) > 1:
            overlap_skipped += 1
            continue
        if not gold and not hyp:
            continue
        scored += 1
        if not gold:
            false_alarm += 1
        elif not hyp:
            miss += 1
        elif len(hyp) > 1:
            multi_pred += 1
        else:
            key = (next(iter(gold)), next(iter(hyp)))
            pair_counts[key] = pair_counts.get(key, 0) + 1
            single_pairs += 1

    candidates = real_ids + ["__unmapped_" + str(i) for i in range(len(predicted_ids))]
    best_confusion = single_pairs
    # The number of distinct speakers is hard-capped at four by parse_rttm.
    for perm in itertools.permutations(candidates, len(predicted_ids)):
        mapping = dict(zip(predicted_ids, perm))
        correct = sum(
            count for (actual, predicted), count in pair_counts.items()
            if mapping[predicted] == actual
        )
        best_confusion = min(best_confusion, single_pairs - correct)
    confusion = multi_pred + best_confusion
    errors = miss + false_alarm + confusion
    return {
        "metric": "frame_error_proxy_nonoverlap_not_standard_DER",
        "frame_ms": 10,
        "reference_speaker_count": len(real_ids),
        "predicted_speaker_count": len(predicted_ids),
        "scored_frames": scored,
        "reference_overlap_frames_skipped": overlap_skipped,
        "miss_frames": miss,
        "false_alarm_frames": false_alarm,
        "confusion_frames": confusion,
        "error_fraction": round(errors / scored, 6) if scored else None,
    }


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--reference", required=True)
    p.add_argument("--predicted", required=True)
    args = p.parse_args(argv)
    try:
        ref = parse_rttm(Path(args.reference).read_text(encoding="utf-8"))
        pred = parse_rttm(Path(args.predicted).read_text(encoding="utf-8"), allow_empty=True)
        print(json.dumps({"lab": "VOICE-00", "ok": True, **assess(ref, pred)}))
        return 0
    except (OSError, UnicodeError, ValueError, MetricError):
        print(json.dumps({
            "lab": "VOICE-00", "ok": False,
            "error_code": "INVALID_OR_UNREADABLE_RTTM",
        }), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
