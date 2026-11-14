#!/usr/bin/env python3
"""VOICE-01M: opt-in AMI reference benchmark, offline inference, no personal data.

Preparation downloads one publicly licensed AMI meeting and manual RTTM from
fixed trusted sources, stores only a 100-second anonymized clip/reference and
a SHA256 manifest OUTSIDE Git. Inference is entirely offline and writes nothing.
Score is an exact interval-based DER-LIKE error, NOT official md-eval/DER.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import wave
from collections import defaultdict
from pathlib import Path

import offline_diarization as voice
from voice01k_similarity import MODEL_NAME, MODEL_SHA256, sha_matches

MEETING = "ES2002a"
OFFSET = 60.0
SECONDS = 100.0
RATE = 16000
AUDIO_URL = (
    "https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/"
    "amicorpus/ES2002a/audio/ES2002a.Mix-Headset.wav"
)
RTTM_URL = (
    "https://raw.githubusercontent.com/pyannote/AMI-diarization-setup/"
    "main/only_words/rttms/train/ES2002a.rttm"
)
CLIP_NAME = "ami_es2002a_60_160.wav"
REF_NAME = "ami_es2002a_60_160.rttm"
MANIFEST_NAME = "ami_es2002a_60_160.manifest.json"
SEG_MODEL = "sherpa-onnx-pyannote-segmentation-3-0/model.onnx"
ERES_MODEL = "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
MAX_AUDIO_BYTES = 65_000_000
MAX_RTTM_BYTES = 2_000_000
MAX_AUTOMATIC_CLUSTERS = 64  # Fail safely above this; do not force a count in sherpa.


class BenchmarkError(ValueError):
    pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def locations(base: Path) -> tuple[Path, Path, Path]:
    d = base / "benchmarks" / "voice01m_ami"
    return d / CLIP_NAME, d / REF_NAME, d / MANIFEST_NAME


def download_fixed(url: str, max_bytes: int) -> bytes:
    """Explicit preparation only: a bounded, fixed HTTPS public data download."""
    req = urllib.request.Request(url, headers={"User-Agent": "LUMIA-VOICE-01M/1.0"})
    with urllib.request.urlopen(req, timeout=35) as handle:
        target = urllib.parse.urlparse(handle.geturl())
        if target.scheme != "https":
            raise BenchmarkError("UNSAFE_DOWNLOAD_REDIRECT")
        data = bytearray()
        while True:
            block = handle.read(min(1024 * 1024, max_bytes - len(data) + 1))
            if not block:
                break
            data.extend(block)
            if len(data) > max_bytes:
                raise BenchmarkError("PUBLIC_DOWNLOAD_TOO_LARGE")
    return bytes(data)


def cut_audio(source: bytes) -> bytes:
    """Retain the reference-aligned time interval; no re-encoding."""
    try:
        with wave.open(io.BytesIO(source), "rb") as wav:
            props = (wav.getnchannels(), wav.getsampwidth(),
                     wav.getframerate(), wav.getcomptype())
            if props != (1, 2, RATE, "NONE"):
                raise BenchmarkError("AMI_AUDIO_FORMAT_NOT_SUPPORTED")
            first = int(OFFSET * RATE)
            count = int(SECONDS * RATE)
            if wav.getnframes() < first + count:
                raise BenchmarkError("AMI_AUDIO_TOO_SHORT")
            wav.setpos(first)
            pcm = wav.readframes(count)
            if len(pcm) != count * 2:
                raise BenchmarkError("AMI_AUDIO_INCOMPLETE")
    except (wave.Error, EOFError, OSError, ValueError) as exc:
        if isinstance(exc, BenchmarkError):
            raise
        raise BenchmarkError("AMI_AUDIO_UNREADABLE") from None
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return out.getvalue()


def validate_segments(segments: list[tuple], *, max_duration: float = SECONDS,
                      max_speakers: int = 4):
    for start, end, name in segments:
        if (not math.isfinite(start) or not math.isfinite(end) or
                start < 0 or end <= start or end > max_duration + 1e-6 or
                not isinstance(name, str) or not name):
            raise BenchmarkError("INVALID_SEGMENTS")
    if len({name for _, _, name in segments}) > max_speakers:
        raise BenchmarkError(
            "TOO_MANY_AUTOMATIC_CLUSTERS" if max_speakers > 4
            else "MORE_THAN_FOUR_SPEAKERS"
        )


def crop_manual_rttm(source: str) -> tuple[str, list[tuple]]:
    """Public RTTM is pre-existing manual annotation, NOT a model prediction."""
    selected = []
    for line in source.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) < 8 or fields[0] != "SPEAKER":
            raise BenchmarkError("INVALID_PUBLIC_REFERENCE")
        if fields[1] != MEETING:
            continue
        try:
            start, duration = float(fields[3]), float(fields[4])
        except ValueError:
            raise BenchmarkError("INVALID_PUBLIC_REFERENCE") from None
        if not all(math.isfinite(x) for x in (start, duration)) or start < 0 or duration <= 0:
            raise BenchmarkError("INVALID_PUBLIC_REFERENCE")
        left = max(start, OFFSET)
        right = min(start + duration, OFFSET + SECONDS)
        if right - left > 1e-8:
            selected.append((left - OFFSET, right - OFFSET, fields[7]))
    names = sorted({p for _, _, p in selected})
    if not 2 <= len(names) <= 4 or not selected:
        raise BenchmarkError("PUBLIC_REFERENCE_NOT_MULTISPEAKER")
    aliases = {name: "p" + str(i) for i, name in enumerate(names)}
    anonymous = sorted(
        [(max(0.0, a), min(SECONDS, b), aliases[p]) for a, b, p in selected],
        key=lambda x: (x[0], x[1], x[2]),
    )
    validate_segments(anonymous)
    rttm = "".join(
        "SPEAKER ami_100s 1 {:.5f} {:.5f} <NA> <NA> {} <NA> <NA>\n".format(
            start, end - start, speaker)
        for start, end, speaker in anonymous
    )
    return rttm, anonymous


def parse_private_rttm(source: str) -> list[tuple]:
    result = []
    for line in source.splitlines():
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 10 or fields[0] != "SPEAKER" or fields[1] != "ami_100s":
            raise BenchmarkError("INVALID_LOCAL_REFERENCE")
        try:
            a, length = float(fields[3]), float(fields[4])
        except ValueError:
            raise BenchmarkError("INVALID_LOCAL_REFERENCE") from None
        result.append((a, a + length, fields[7]))
    validate_segments(result)
    if len({sp for _, _, sp in result}) < 2:
        raise BenchmarkError("INVALID_LOCAL_REFERENCE")
    return result


def prepare(base: Path) -> dict:
    wav_path, ref_path, manifest_path = locations(base)
    if any(p.exists() for p in (wav_path, ref_path, manifest_path)):
        raise BenchmarkError("LOCAL_BENCHMARK_ALREADY_EXISTS")
    # First download into memory: the original full-length meeting is NOT
    # persisted. Only the extracted WAV and anonymized RTTM are written.
    wav = cut_audio(download_fixed(AUDIO_URL, MAX_AUDIO_BYTES))
    raw_ref = download_fixed(RTTM_URL, MAX_RTTM_BYTES).decode("utf-8")
    rttm, turns = crop_manual_rttm(raw_ref)
    ref = rttm.encode("utf-8")
    manifest = {
        "lab": "VOICE-01M", "corpus": "AMI", "meeting": MEETING,
        "source_audio": AUDIO_URL, "source_rttm": RTTM_URL,
        "license_audio_annotations": "CC BY 4.0",
        "reference_type": "AMI manual only_words",
        "offset_seconds": OFFSET, "duration_seconds": SECONDS,
        "audio_sha256": digest(wav), "reference_sha256": digest(ref),
        "reference_speakers": len({p for _, _, p in turns}),
        "source_original_audio_persisted": False,
    }
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create, never overwrite user-curated material.
    try:
        for path, data in (
            (wav_path, wav), (ref_path, ref),
            (manifest_path, (json.dumps(manifest, indent=2) + "\n").encode("utf-8")),
        ):
            with path.open("xb") as out:
                out.write(data)
    except OSError:
        # Do not silently delete or overwrite user files.
        raise BenchmarkError("LOCAL_WRITE_FAILED") from None
    return {
        "lab": "VOICE-01M", "ok": True, "mode": "prepared_public_reference",
        "corpus": "AMI", "offset_seconds": OFFSET,
        "duration_seconds": SECONDS, "reference_speakers": manifest["reference_speakers"],
        "reference_turns": len(turns), "saved_public_clip": True,
        "saved_anonymized_reference": True, "full_meeting_audio_saved": False,
        "network_used_for_preparation": True,
        "inference_executed": False,
    }


def load_prepared(base: Path) -> tuple[bytes, list[tuple]]:
    wav, ref, meta = locations(base)
    if not all(path.is_file() for path in (wav, ref, meta)):
        raise BenchmarkError("BENCHMARK_NOT_PREPARED")
    try:
        manifest = json.loads(meta.read_text(encoding="utf-8"))
        if (manifest["lab"] != "VOICE-01M" or
                manifest["meeting"] != MEETING or
                manifest["offset_seconds"] != OFFSET or
                manifest["duration_seconds"] != SECONDS):
            raise BenchmarkError("BENCHMARK_MANIFEST_MISMATCH")
        if not sha_matches(wav, None, manifest["audio_sha256"]):
            raise BenchmarkError("BENCHMARK_AUDIO_MODIFIED")
        if not sha_matches(ref, None, manifest["reference_sha256"]):
            raise BenchmarkError("BENCHMARK_REFERENCE_MODIFIED")
        pcm, duration = voice.read_pcm16_mono(str(wav))
        if abs(duration - SECONDS) > 1e-4:
            raise BenchmarkError("BENCHMARK_AUDIO_DURATION_CHANGED")
        turns = parse_private_rttm(ref.read_text(encoding="utf-8"))
    except BenchmarkError:
        raise
    except (ValueError, OSError, KeyError, UnicodeError, TypeError):
        raise BenchmarkError("BENCHMARK_MANIFEST_INVALID") from None
    return pcm, turns


def score_intervals(reference: list[tuple], predicted: list[tuple],
                    *, duration: float = SECONDS) -> dict:
    """Exact segment-boundary integral, globally mapped; no forgiveness collar.

    This is DER-like (MISS+FA+CONF / reference speaker-time) with overlapping
    voices counted. It is NOT the published official DER protocol (UEM/collar).
    """
    validate_segments(reference, max_duration=duration)
    # The manual reference has four speakers. Automatic diarizers may return
    # substantially MORE groups due to overfragmentation; scoring must count
    # and penalize those groups, not truncate or force num_speakers=4.
    validate_segments(predicted, max_duration=duration,
                      max_speakers=MAX_AUTOMATIC_CLUSTERS)
    if not reference:
        raise BenchmarkError("EMPTY_REFERENCE")
    event: dict[float, list] = defaultdict(list)
    for kind, turns in (("r", reference), ("p", predicted)):
        for a, b, sp in turns:
            event[a].append((kind, sp, 1))
            event[b].append((kind, sp, -1))
    points = sorted(set([0.0, duration]) | set(event))
    active = {"r": defaultdict(int), "p": defaultdict(int)}
    cooccur = defaultdict(float)
    total_ref = missed = false_alarm = baseline_confusion = overlap = 0.0
    for at, until in zip(points, points[1:]):
        for kind, speaker, delta in event.get(at, []):
            active[kind][speaker] += delta
            if active[kind][speaker] < 0:
                raise BenchmarkError("INVALID_EVENT_ORDER")
        r = {sp for sp, count in active["r"].items() if count > 0}
        p = {sp for sp, count in active["p"].items() if count > 0}
        dt = until - at
        if dt <= 0:
            continue
        total_ref += len(r) * dt
        missed += max(len(r) - len(p), 0) * dt
        false_alarm += max(len(p) - len(r), 0) * dt
        baseline_confusion += min(len(r), len(p)) * dt
        if len(r) > 1:
            overlap += dt
        for a in r:
            for b in p:
                cooccur[a, b] += dt
    if total_ref <= 0:
        raise BenchmarkError("EMPTY_REFERENCE")
    rids = sorted({sp for _, _, sp in reference})
    pids = sorted({sp for _, _, sp in predicted})
    # Exact maximum-weight one-to-one assignment. Unmatched automatic groups
    # remain unmatched and contribute to confusion; they are NOT merged.
    # Mask represents assigned manual reference speakers (at most four), so
    # O(predicted_groups * 2**reference_groups * reference_groups) replaces the
    # factorial permutation enumeration that cannot scale above four groups.
    states = {0: 0.0}
    for predicted_sp in pids:
        next_states = dict(states)  # Skip this predicted group (unmapped).
        for mask, cumulative in states.items():
            for idx, gold in enumerate(rids):
                bit = 1 << idx
                if mask & bit:
                    continue
                new_mask = mask | bit
                candidate = cumulative + cooccur.get((gold, predicted_sp), 0.0)
                if candidate > next_states.get(new_mask, float("-inf")):
                    next_states[new_mask] = candidate
        states = next_states
    correct = max(states.values(), default=0.0)
    confusion = max(0.0, baseline_confusion - correct)
    error = (missed + false_alarm + confusion) / total_ref
    return {
        "metric": "time_integrated_der_like_no_collar_not_official_DER",
        "duration_s": duration, "reference_speakers": len(rids),
        "predicted_speakers": len(pids),
        "reference_speaker_seconds": round(total_ref, 4),
        "overlap_wallclock_seconds": round(overlap, 4),
        "miss_seconds": round(missed, 4),
        "false_alarm_seconds": round(false_alarm, 4),
        "confusion_seconds": round(confusion, 4),
        "error_fraction": round(error, 6), "error_percent": round(error * 100, 3),
        "collar_seconds": 0.0, "overlap_included": True,
    }


def run(base: Path, mode: str) -> dict:
    pcm, reference = load_prepared(base)
    seg = base / "models" / SEG_MODEL
    names = [("CAM++", base / "models" / MODEL_NAME)]
    if mode == "both":
        names.append(("ERes2Net", base / "models" / ERES_MODEL))
    if not seg.is_file():
        raise BenchmarkError("SEGMENTATION_MODEL_MISSING")
    if not sha_matches(names[0][1], None, MODEL_SHA256):
        raise BenchmarkError("CAMPP_MODEL_MISMATCH")
    if any(not p.is_file() for _, p in names):
        raise BenchmarkError("EMBEDDING_MODEL_MISSING")
    stats = []
    for name, model in names:
        started = time.perf_counter()
        turns, count = voice.diarize(pcm, str(seg), str(model), -1,
                                    cluster_threshold=0.5)
        prediction = [(x["start"], x["end"], x["speaker"]) for x in turns]
        metric = score_intervals(reference, prediction)
        stats.append({
            "model": name, "threshold": 0.5,
            "auto_speaker_count": count, "segments": len(turns),
            "cpu_elapsed_ms": round((time.perf_counter() - started) * 1000),
            **metric,
        })
    return {
        "lab": "VOICE-01M", "ok": True, "mode": "offline_reference_comparison",
        "corpus": "AMI", "clip_seconds": SECONDS,
        "reference_type": "public_manual_only_words",
        "models": stats, "prediction_files_written": 0,
        "embedding_vectors_exported": False, "microphone_enabled": False,
        "network_enabled_during_inference": False,
        "identity_verified": False,
        "independent_of_voice01k_l_audio": True,
    }


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="VOICE-01M offline AMI benchmark")
    actions = p.add_mutually_exclusive_group()
    actions.add_argument("--doctor", action="store_true")
    actions.add_argument("--prepare", action="store_true")
    actions.add_argument("--run", action="store_true")
    p.add_argument("--consent", action="store_true",
                   help="Opt-in to public download or offline local inference")
    p.add_argument("--compare", action="store_true",
                   help="Also run ERes2Net on the same reference, without tuning")
    args = p.parse_args(argv)
    if args.doctor:
        base = os.environ.get("LOCALAPPDATA", "")
        prepared = bool(base and all(p.is_file() for p in locations(
            Path(base) / "ORBI" / "LUMIA-VOICE-LAB")))
        print(json.dumps({
            "lab": "VOICE-01M", "mode": "doctor_no_network_or_inference",
            "prepared_files_present": prepared, "offset_seconds": OFFSET,
            "duration_seconds": SECONDS, "microphone_enabled": False,
            "network_used": False, "files_written": 0,
        }))
        return 0
    try:
        if not args.consent:
            raise BenchmarkError("CONSENT_REQUIRED")
        if not args.prepare and not args.run:
            raise BenchmarkError("MISSING_ACTION")
        if args.compare and not args.run:
            raise BenchmarkError("COMPARE_REQUIRES_RUN")
        local = os.environ.get("LOCALAPPDATA")
        if not local:
            raise BenchmarkError("LOCALAPPDATA_REQUIRED")
        base = Path(local) / "ORBI" / "LUMIA-VOICE-LAB"
        result = prepare(base) if args.prepare else run(
            base, "both" if args.compare else "campp"
        )
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except BenchmarkError as exc:
        error = str(exc)
    except (OSError, ValueError, UnicodeError, urllib.error.URLError, wave.Error):
        error = "LOCAL_PREPARE_OR_RUNTIME_ERROR"
    except Exception:
        error = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({"lab": "VOICE-01M", "ok": False, "error_code": error}),
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
