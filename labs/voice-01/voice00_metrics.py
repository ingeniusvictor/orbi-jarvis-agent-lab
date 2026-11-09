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


def parse_rttm(text: str):
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
    if not segments:
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
    duration = max(end for _, end, _ in reference + prediction)
    n = math.ceil(duration / FRAME)
    expected = labels_per_frame(reference, n)
    observed = labels_per_frame(prediction, n)
    real_ids = sorted({s for _, _, s in reference})
    predicted_ids = sorted({s for _, _, s in prediction})
    # Find best global permutation (speaker IDs have no intrinsic meaning).
    candidates = real_ids + ["__unmapped_" + str(i) for i in range(len(predicted_ids))]
    best = None
    for perm in itertools.permutations(candidates, len(predicted_ids)):
        mapping = dict(zip(predicted_ids, perm))
        miss = false_alarm = confusion = scored = overlap_skipped = 0
        for gold, hyp in zip(expected, observed):
            if len(gold) > 1:
                overlap_skipped += 1
                continue
            if not gold and not hyp:
                continue
            if not gold:
                false_alarm += 1
            elif not hyp:
                miss += 1
            elif len(hyp) > 1 or mapping[next(iter(hyp))] not in gold:
                confusion += 1
            scored += 1
        ranked = (miss + false_alarm + confusion,
                  confusion, false_alarm, miss, scored, overlap_skipped)
        if best is None or ranked < best:
            best = ranked
    errors, confusion, false_alarm, miss, scored, overlap_skipped = best
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
        pred = parse_rttm(Path(args.predicted).read_text(encoding="utf-8"))
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
