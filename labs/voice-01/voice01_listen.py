#!/usr/bin/env python3
"""VOICE-01I: play small excerpts of local public WAVs without exporting audio.

Offline review only; Windows winsound plays constructed WAV bytes in memory.
No recording, network, identity inference, or integration with LUMIA.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import sys
import wave
from pathlib import Path

RATE = 16000
MAX_WAV_SECONDS = 600
MAX_CLIP_SECONDS = 25
MAX_CLIPS = 8


class ReviewError(ValueError):
    pass


def parse_clip(raw: str, duration: float) -> tuple[float, float]:
    try:
        parts = raw.split(":")
        if len(parts) != 2:
            raise ValueError("Expected start:end")
        a, b = (float(p) for p in parts)
    except ValueError:
        raise ReviewError("INVALID_CLIP") from None
    if (not math.isfinite(a) or not math.isfinite(b)
            or a < 0 or b <= a or b > duration + 0.001
            or b - a > MAX_CLIP_SECONDS):
        raise ReviewError("INVALID_CLIP")
    return a, min(b, duration)


def load_public_pcm(path: str) -> tuple[bytes, float]:
    try:
        p = Path(path)
        if not p.is_file() or p.stat().st_size > 25_000_000:
            raise ReviewError("INVALID_WAV")
        with wave.open(str(p), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(),
                    source.getframerate(), source.getcomptype()) != (
                    1, 2, RATE, "NONE"):
                raise ReviewError("UNSUPPORTED_WAV_FORMAT")
            n = source.getnframes()
            if not 0 < n <= MAX_WAV_SECONDS * RATE:
                raise ReviewError("INVALID_DURATION")
            pcm = source.readframes(n)
            if len(pcm) != 2 * n:
                raise ReviewError("INCOMPLETE_WAV")
            return pcm, n / RATE
    except ReviewError:
        raise
    except (OSError, EOFError, ValueError, wave.Error):
        raise ReviewError("INVALID_WAV") from None


def build_excerpt(pcm: bytes, start: float, end: float) -> bytes:
    first = int(start * RATE)
    last = int(end * RATE)
    if first < 0 or last <= first or last * 2 > len(pcm):
        raise ReviewError("INVALID_CLIP")
    out = io.BytesIO()
    with wave.open(out, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(pcm[first * 2:last * 2])
    return out.getvalue()


def main(argv=None, *, audio_player=None):
    parser = argparse.ArgumentParser(
        description="VOICE-01I: local in-memory audition of public WAV clips")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--wav")
    parser.add_argument("--clip", action="append", default=[],
                        help="Time range in seconds, start:end; may repeat")
    parser.add_argument("--consent", action="store_true",
                        help="Confirm local listening of the supplied WAV")
    args = parser.parse_args(argv)

    if args.doctor:
        print(json.dumps({
            "lab": "VOICE-01I", "platform": sys.platform,
            "max_clip_seconds": MAX_CLIP_SECONDS,
            "network_enabled": False, "microphone_enabled": False,
            "files_written": 0,
        }))
        return 0
    try:
        if not args.consent:
            raise ReviewError("CONSENT_REQUIRED")
        if not args.wav or not 1 <= len(args.clip) <= MAX_CLIPS:
            raise ReviewError("MISSING_WAV_OR_CLIPS")
        pcm, seconds = load_public_pcm(args.wav)
        clips = [parse_clip(spec, seconds) for spec in args.clip]
        if audio_player is None:
            if sys.platform != "win32":
                raise ReviewError("WINDOWS_PLAYBACK_ONLY")
            import winsound

            def audio_player(data):
                # PlaySound is synchronous by default; SND_SYNC does not
                # exist in the Windows winsound Python module.
                winsound.PlaySound(data, winsound.SND_MEMORY)

        for i, (start, end) in enumerate(clips, 1):
            data = build_excerpt(pcm, start, end)
            print(f"VOICE-01I clip {i}/{len(clips)}: "
                  f"{start:.3f}-{end:.3f} s", flush=True)
            audio_player(data)

        print(json.dumps({
            "lab": "VOICE-01I", "ok": True,
            "clips_played": len(clips),
            "files_written": 0, "microphone_enabled": False,
            "identity_confirmed": False,
        }))
        return 0
    except ReviewError as e:
        reason = str(e)
    except (OSError, RuntimeError):
        reason = "PLAYBACK_UNAVAILABLE"
    print(json.dumps({"lab": "VOICE-01I", "ok": False,
                      "error_code": reason}), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
