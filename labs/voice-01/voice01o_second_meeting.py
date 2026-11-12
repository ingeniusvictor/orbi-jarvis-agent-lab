#!/usr/bin/env python3
"""VOICE-01O: independent AMI ES2003a cross-meeting diarization validation.

Explicitly opt-in public preparation (HTTPS), or offline inference on local
checksummed public clip. No microphone, private data, model downloads,
raw embeddings, detailed turn export, or production LUMIA changes.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import sys
import time
import wave
from pathlib import Path

import voice01m_ami_benchmark as ami
import voice01n_reference_matrix as matrix

MEETING = "ES2003a"  # Different meeting and participant IDs from ES2002a.
START_S = 10.0
LENGTH_S = 100.0
RATE = 16000
AUDIO_URL = ("https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/"
             "amicorpus/HeadsetAudio/ES2003a.Mix-Headset.wav")
REF_URL = ("https://raw.githubusercontent.com/pyannote/"
           "AMI-diarization-setup/main/only_words/rttms/train/ES2003a.rttm")
FILE_PREFIX = "ami_es2003a_10_110"
LICENSE = "CC BY 4.0"
MAX_SOURCE_BYTES = 65_000_000


def paths(base: Path):
    d = base / "benchmarks" / "voice01o_ami"
    return (
        d / (FILE_PREFIX + ".wav"),
        d / (FILE_PREFIX + ".rttm"),
        d / (FILE_PREFIX + ".manifest.json"),
    )


def crop_audio(source: bytes):
    """Exact 100s PCM 16k mono / 16bit excerpt from public WAV in RAM."""
    try:
        with wave.open(io.BytesIO(source), "rb") as w:
            if (w.getframerate() != RATE or w.getnchannels() != 1
                    or w.getsampwidth() != 2 or w.getcomptype() != "NONE"):
                raise ami.BenchmarkError("PUBLIC_AUDIO_UNSUPPORTED_FORMAT")
            start = int(START_S * RATE)
            frames = int(LENGTH_S * RATE)
            if w.getnframes() < start + frames:
                raise ami.BenchmarkError("PUBLIC_AUDIO_TOO_SHORT")
            w.setpos(start)
            pcm = w.readframes(frames)
            if len(pcm) != frames * 2:
                raise ami.BenchmarkError("PUBLIC_AUDIO_INCOMPLETE")
    except (wave.Error, OSError, EOFError):
        raise ami.BenchmarkError("PUBLIC_AUDIO_UNREADABLE") from None
    output = io.BytesIO()
    with wave.open(output, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm)
    return output.getvalue()


def crop_reference(source: str):
    """Fixed AMI manual only_words RTTM; anonymize 4 speaker IDs."""
    observed = []
    for row in source.splitlines():
        if not row.strip() or row.lstrip().startswith("#"):
            continue
        parts = row.split()
        if len(parts) < 8 or parts[0] != "SPEAKER":
            raise ami.BenchmarkError("INVALID_PUBLIC_RTTM")
        if parts[1] != MEETING:
            continue
        try:
            start = float(parts[3])
            span = float(parts[4])
        except ValueError:
            raise ami.BenchmarkError("INVALID_PUBLIC_RTTM") from None
        if not (math.isfinite(start) and math.isfinite(span)
                and start >= 0 and span > 0):
            raise ami.BenchmarkError("INVALID_PUBLIC_RTTM")
        left = max(START_S, start)
        right = min(START_S + LENGTH_S, start + span)
        if right > left:
            observed.append((left - START_S, right - START_S, parts[7]))
    names = sorted({speaker for _, _, speaker in observed})
    if len(names) != 4:
        raise ami.BenchmarkError("SECOND_MEETING_REFERENCE_NOT_FOUR_SPEAKERS")
    labels = {original: "p" + str(i) for i, original in enumerate(names)}
    turns = sorted(
        [(max(0, a), min(LENGTH_S, b), labels[speaker])
         for a, b, speaker in observed],
        key=lambda x: (x[0], x[1], x[2]),
    )
    ami.validate_segments(turns, max_duration=LENGTH_S)
    raw = "".join(
        "SPEAKER ami_second 1 {:.5f} {:.5f} <NA> <NA> {} <NA> <NA>\n".format(
            start, end - start, name)
        for start, end, name in turns
    )
    return raw, turns


def parse_local_reference(raw: str):
    turns = []
    for row in raw.splitlines():
        if not row.strip():
            continue
        parts = row.split()
        if (len(parts) != 10 or parts[0] != "SPEAKER"
                or parts[1] != "ami_second" or parts[7] not in
                {"p0", "p1", "p2", "p3"}):
            raise ami.BenchmarkError("INVALID_LOCAL_RTTM")
        try:
            start, duration = float(parts[3]), float(parts[4])
        except ValueError:
            raise ami.BenchmarkError("INVALID_LOCAL_RTTM") from None
        turns.append((start, start + duration, parts[7]))
    ami.validate_segments(turns, max_duration=LENGTH_S)
    if len({s for _, _, s in turns}) != 4:
        raise ami.BenchmarkError("INVALID_LOCAL_RTTM")
    return turns


def prepare(base: Path):
    wav, ref, meta = paths(base)
    if any(p.exists() for p in (wav, ref, meta)):
        raise ami.BenchmarkError("SECOND_MEETING_ALREADY_PREPARED")
    audio_clip = crop_audio(ami.download_fixed(AUDIO_URL, MAX_SOURCE_BYTES))
    source_ref = ami.download_fixed(REF_URL, ami.MAX_RTTM_BYTES).decode("utf-8")
    rttm, turns = crop_reference(source_ref)
    reference_bytes = rttm.encode("utf-8")
    manifest = {
        "lab": "VOICE-01O", "meeting": MEETING, "corpus": "AMI",
        "reference_type": "published_manual_only_words",
        "source_audio": AUDIO_URL, "source_rttm": REF_URL,
        "license_audio_annotations": LICENSE,
        "offset_seconds": START_S, "duration_seconds": LENGTH_S,
        "audio_sha256": ami.digest(audio_clip),
        "reference_sha256": ami.digest(reference_bytes),
        "manual_speakers": 4, "full_original_recording_saved": False,
    }
    meta_bytes = (json.dumps(manifest, indent=2) + "\n").encode("utf-8")
    wav.parent.mkdir(parents=True, exist_ok=True)
    try:
        for path, data in ((wav, audio_clip), (ref, reference_bytes), (meta, meta_bytes)):
            with path.open("xb") as output:
                output.write(data)
    except OSError:
        raise ami.BenchmarkError("LOCAL_WRITE_FAILED") from None
    return {
        "lab": "VOICE-01O", "ok": True, "mode": "prepared_independent_meeting",
        "corpus": "AMI", "meeting": MEETING,
        "offset_seconds": START_S, "duration_seconds": LENGTH_S,
        "manual_reference_speakers": 4, "reference_turns": len(turns),
        "public_clip_saved_locally": True,
        "anonymized_rttm_saved_locally": True,
        "full_original_recording_saved": False,
        "network_used_for_public_preparation": True,
        "inference_executed": False,
    }


def load_prepared(base: Path):
    wav, ref, meta = paths(base)
    if not all(path.is_file() for path in (wav, ref, meta)):
        raise ami.BenchmarkError("SECOND_MEETING_NOT_PREPARED")
    try:
        manifest = json.loads(meta.read_text(encoding="utf-8"))
        if (manifest["lab"] != "VOICE-01O" or
                manifest["meeting"] != MEETING or
                manifest["offset_seconds"] != START_S or
                manifest["duration_seconds"] != LENGTH_S or
                manifest["manual_speakers"] != 4):
            raise ami.BenchmarkError("SECOND_MEETING_MANIFEST_MISMATCH")
        if not ami.sha_matches(wav, None, manifest["audio_sha256"]):
            raise ami.BenchmarkError("SECOND_MEETING_AUDIO_MODIFIED")
        if not ami.sha_matches(ref, None, manifest["reference_sha256"]):
            raise ami.BenchmarkError("SECOND_MEETING_REFERENCE_MODIFIED")
        pcm, seconds = ami.voice.read_pcm16_mono(str(wav))
        if abs(seconds - LENGTH_S) > 1e-5:
            raise ami.BenchmarkError("SECOND_MEETING_DURATION_MISMATCH")
        turns = parse_local_reference(ref.read_text(encoding="utf-8"))
    except ami.BenchmarkError:
        raise
    except (ValueError, TypeError, KeyError, OSError, UnicodeError):
        raise ami.BenchmarkError("SECOND_MEETING_METADATA_UNREADABLE") from None
    return pcm, turns


def evaluate(base: Path, *, compare: bool):
    pcm, reference = load_prepared(base)
    segmentation = base / "models" / ami.SEG_MODEL
    models = [("CAM++", base / "models" / ami.MODEL_NAME)]
    if compare:
        models.append(("ERes2Net", base / "models" / ami.ERES_MODEL))
    if not segmentation.is_file():
        raise ami.BenchmarkError("SEGMENTATION_MODEL_MISSING")
    if not ami.sha_matches(models[0][1], None, ami.MODEL_SHA256):
        raise ami.BenchmarkError("CAMPP_MODEL_MISMATCH")
    if any(not path.is_file() for _, path in models):
        raise ami.BenchmarkError("EMBEDDING_MODEL_MISSING")
    scored = []
    for name, path in models:
        tic = time.perf_counter()
        predicted_segments, count = ami.voice.diarize(
            pcm, str(segmentation), str(path), -1, cluster_threshold=0.5,
        )
        predicted = [(x["start"], x["end"], x["speaker"])
                     for x in predicted_segments]
        metrics = ami.score_intervals(reference, predicted, duration=LENGTH_S)
        matrix_summary = matrix.summarize_matrix(
            reference, predicted, duration=LENGTH_S,
        )
        if count != matrix_summary["prediction_count"]:
            raise ami.BenchmarkError("INCONSISTENT_AUTOMATIC_COUNT")
        scored.append({
            "model": name, "threshold": 0.5,
            "speaker_count_mode": "automatic_not_forced",
            "auto_speaker_count": count, "segments": len(predicted),
            "cpu_elapsed_ms": round((time.perf_counter() - tic) * 1000),
            "der_like_error_percent": metrics["error_percent"],
            "miss_seconds": metrics["miss_seconds"],
            "false_alarm_seconds": metrics["false_alarm_seconds"],
            "confusion_seconds": metrics["confusion_seconds"],
            "overlap_wallclock_seconds": metrics["overlap_wallclock_seconds"],
            "reference_speaker_seconds": metrics["reference_speaker_seconds"],
            "reference_split_diagnostics": matrix_summary[
                "reference_split_diagnostics"],
            "predicted_group_details": matrix_summary["predicted_group_details"],
            "unambiguous_wallclock_seconds": matrix_summary[
                "unambiguous_wallclock_seconds"],
        })
    return {
        "lab": "VOICE-01O", "ok": True,
        "mode": "second_meeting_ami_independent_reference",
        "corpus": "AMI", "meeting": MEETING, "clip_seconds": LENGTH_S,
        "manual_reference_speakers": 4, "reference_type": "published_manual_only_words",
        "models": scored, "offline_inference": True,
        "new_downloads_during_inference": 0, "files_written_during_inference": 0,
        "microphone_enabled": False, "network_enabled_during_inference": False,
        "identity_verified": False, "official_der_validated": False,
        "generalization_validated": False,
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="VOICE-01O independent AMI meeting")
    modes = p.add_mutually_exclusive_group()
    modes.add_argument("--doctor", action="store_true")
    modes.add_argument("--prepare", action="store_true")
    modes.add_argument("--run", action="store_true")
    p.add_argument("--compare", action="store_true")
    p.add_argument("--consent", action="store_true")
    args = p.parse_args(argv)
    if args.doctor:
        local = os.environ.get("LOCALAPPDATA")
        present = bool(local and all(x.is_file() for x in paths(
            Path(local) / "ORBI" / "LUMIA-VOICE-LAB")))
        print(json.dumps({
            "lab": "VOICE-01O", "mode": "doctor_no_network_or_inference",
            "prepared_files_present": present, "meeting": MEETING,
            "duration_seconds": LENGTH_S, "models":
                ["CAM++", "ERes2Net"] if args.compare else ["CAM++"],
            "microphone_enabled": False, "network_enabled": False,
            "files_written": 0,
        }))
        return 0
    try:
        if not args.consent:
            raise ami.BenchmarkError("CONSENT_REQUIRED")
        if not args.prepare and not args.run:
            raise ami.BenchmarkError("ACTION_REQUIRED")
        if args.compare and not args.run:
            raise ami.BenchmarkError("COMPARE_REQUIRES_RUN")
        local = os.environ.get("LOCALAPPDATA")
        if not local:
            raise ami.BenchmarkError("LOCALAPPDATA_REQUIRED")
        base = Path(local) / "ORBI" / "LUMIA-VOICE-LAB"
        result = prepare(base) if args.prepare else evaluate(
            base, compare=args.compare,
        )
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except ami.BenchmarkError as exc:
        code = str(exc)
    except (OSError, ValueError, ImportError, UnicodeError):
        code = "LOCAL_PREPARE_OR_RUNTIME_ERROR"
    except Exception:
        code = "LOCAL_MODEL_RUNTIME_ERROR"
    print(json.dumps({
        "lab": "VOICE-01O", "ok": False, "error_code": code,
    }), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
