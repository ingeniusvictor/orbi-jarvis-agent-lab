"""VOICE-00/01 synthetic tests: no microphone, no downloaded models."""
from __future__ import annotations
import io
import sys
import unittest
import wave
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import offline_diarization as voice
import voice00_metrics as metrics
import voice01_listen as audition


def make_wav(seconds=1.0, rate=16000, channels=1):
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\0" * int(rate * seconds * 2 * channels))
    return out.getvalue()


def rttm(start, duration, speaker):
    return f"SPEAKER anonymous 1 {start} {duration} <NA> <NA> {speaker} <NA> <NA>"


class VoiceLabTests(unittest.TestCase):
    def test_doctor_requires_no_models(self):
        self.assertEqual(voice.main(["--doctor"]), 0)

    def test_explicit_consent_required(self):
        self.assertEqual(voice.main([]), 1)

    def test_pcm16_valid_and_rejected_formats(self):
        with TemporaryDirectory() as directory:
            p = Path(directory) / "private.wav"
            p.write_bytes(make_wav())
            audio, seconds = voice.read_pcm16_mono(str(p))
            self.assertEqual(len(audio), 32000)
            self.assertEqual(seconds, 1.0)
            p.write_bytes(make_wav(channels=2))
            with self.assertRaises(voice.LabError) as err:
                voice.read_pcm16_mono(str(p))
            self.assertEqual(str(err.exception), "UNSUPPORTED_WAV_FORMAT")
            p.write_bytes(make_wav(rate=8000))
            with self.assertRaises(voice.LabError):
                voice.read_pcm16_mono(str(p))

    def test_rttm_permuted_speakers_have_zero_error(self):
        a = metrics.parse_rttm("\n".join([
            rttm(0, 1, "a"), rttm(1, 1, "b"),
        ]))
        b = metrics.parse_rttm("\n".join([
            rttm(0, 1, "speaker_7"), rttm(1, 1, "speaker_9"),
        ]))
        out = metrics.assess(a, b)
        self.assertEqual(out["error_fraction"], 0)
        self.assertEqual(out["predicted_speaker_count"], 2)

    def test_misses_and_false_alarms_measured(self):
        out = metrics.assess(
            metrics.parse_rttm(rttm(0, 1, "a")),
            metrics.parse_rttm(rttm(1, 1, "b")),
        )
        self.assertGreater(out["error_fraction"], 0.99)
        self.assertGreater(out["miss_frames"], 0)
        self.assertGreater(out["false_alarm_frames"], 0)

    def test_overlap_excluded_and_reported(self):
        out = metrics.assess(
            metrics.parse_rttm("\n".join([
                rttm(0, 1, "a"),
                rttm(0.5, 0.5, "b"),
            ])),
            metrics.parse_rttm(rttm(0, 1, "x")),
        )
        self.assertEqual(out["reference_overlap_frames_skipped"], 50)
        self.assertEqual(out["error_fraction"], 0)

    def test_empty_prediction_means_missed_speech(self):
        gold = metrics.parse_rttm(rttm(0, 1, "a"))
        empty = metrics.parse_rttm("", allow_empty=True)
        out = metrics.assess(gold, empty)
        self.assertEqual(out["predicted_speaker_count"], 0)
        self.assertEqual(out["error_fraction"], 1)
        self.assertEqual(out["false_alarm_frames"], 0)
        self.assertGreater(out["miss_frames"], 0)

    def test_long_four_speaker_dataset_permuted(self):
        # Four distinct IDs swapped; the frame-based score must be zero
        # without rescanning every audio frame for each permutation.
        gold = metrics.parse_rttm("\n".join(
            rttm(i * 15, 15, f"person_{i}") for i in range(4)))
        pred = metrics.parse_rttm("\n".join(
            rttm(i * 15, 15, f"anon_{3-i}") for i in range(4)))
        out = metrics.assess(gold, pred)
        self.assertEqual(out["error_fraction"], 0)
        self.assertEqual(out["reference_speaker_count"], 4)

    def test_nonfinite_rttm_and_more_than_four_speakers_rejected(self):
        for start in ["-1", "nan", "inf", "1000"]:
            with self.assertRaises(metrics.MetricError):
                metrics.parse_rttm(rttm(start, 1, "a"))
        with self.assertRaises(metrics.MetricError):
            metrics.parse_rttm("\n".join(rttm(0, 1, str(i)) for i in range(5)))

    def test_invalid_cluster_threshold_rejected_before_model_import(self):
        for invalid in (0.0, -0.1, 1.0, 2.0, float("nan"), float("inf")):
            with self.subTest(threshold=invalid):
                with self.assertRaises(voice.LabError) as bad:
                    voice.diarize(b"\\x00\\x00", "s", "e", cluster_threshold=invalid)
                self.assertEqual(str(bad.exception), "INVALID_CLUSTER_THRESHOLD")

    def test_manual_review_clip_validation(self):
        self.assertEqual(audition.parse_clip("1.25:3.0", 4), (1.25, 3))
        for bad in ("2:2", "-1:2", "5:6", "0:26", "nan:2", "1:inf", "0", "3:1"):
            with self.subTest(spec=bad):
                with self.assertRaises(audition.ReviewError):
                    audition.parse_clip(bad, 4)

    def test_manual_review_memory_wav_no_files_written(self):
        from contextlib import redirect_stdout
        pcm = bytes(range(256)) * 125
        self.assertEqual(len(pcm), 32000)
        wav_memory = audition.build_excerpt(pcm, 0.1, 0.35)
        with wave.open(io.BytesIO(wav_memory), "rb") as rendered:
            self.assertEqual(rendered.getnchannels(), 1)
            self.assertEqual(rendered.getframerate(), 16000)
            self.assertEqual(rendered.getnframes(), 4000)

        with TemporaryDirectory() as directory:
            p = Path(directory) / "public.wav"
            p.write_bytes(make_wav(seconds=2))
            before = sorted(str(x) for x in Path(directory).iterdir())
            played = []
            with redirect_stdout(io.StringIO()):
                exit_code = audition.main(
                    ["--wav", str(p), "--clip", "0.2:0.6",
                     "--clip", "1:1.4", "--consent"],
                    audio_player=played.append,
                )
            self.assertEqual(exit_code, 0)
            self.assertEqual(len(played), 2)
            self.assertEqual(before, sorted(str(x) for x in Path(directory).iterdir()))

    def test_manual_review_uses_native_winsound_memory_flag(self):
        # Regression: SND_SYNC does not exist in winsound. Synchronous
        # playback is PlaySound's default unless SND_ASYNC is passed.
        from contextlib import redirect_stdout
        from types import SimpleNamespace
        from unittest.mock import patch

        played = []
        fake_winsound = SimpleNamespace(
            SND_MEMORY=0x0004,
            PlaySound=lambda data, flags: played.append((data, flags)),
        )
        # Intentionally no SND_SYNC attribute on the stand-in module.
        with TemporaryDirectory() as directory:
            wav_path = Path(directory) / "public.wav"
            wav_path.write_bytes(make_wav(seconds=1.0))
            with patch.object(audition.sys, "platform", "win32"), \
                    patch.dict(sys.modules, {"winsound": fake_winsound}):
                with redirect_stdout(io.StringIO()):
                    rc = audition.main([
                        "--wav", str(wav_path),
                        "--clip", "0.1:0.2",
                        "--clip", "0.4:0.5",
                        "--consent",
                    ])
            self.assertEqual(rc, 0)
            self.assertEqual(len(played), 2)
            self.assertTrue(all(flags == fake_winsound.SND_MEMORY
                                for _, flags in played))
            for buffer, _ in played:
                with wave.open(io.BytesIO(buffer), "rb") as clip:
                    self.assertEqual(clip.getnframes(), 1600)
            self.assertEqual(sorted(str(x) for x in Path(directory).iterdir()),
                             [str(wav_path)])
        if sys.platform == "win32":
            import winsound
            self.assertTrue(hasattr(winsound, "SND_MEMORY"))

    def test_manual_review_doctor_without_audio(self):
        from contextlib import redirect_stdout
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(audition.main(["--doctor"]), 0)
        self.assertIn('"microphone_enabled": false', out.getvalue())
        self.assertIn('"files_written": 0', out.getvalue())

    def test_sherpa_backend_contract_without_models(self):
        clustering_args = []
        class FakeArray:
            def astype(self, _type):
                return self
            def __truediv__(self, _value):
                return self
        class FakeNumpy:
            float32 = "float32"
            @staticmethod
            def frombuffer(_audio, dtype=None):
                self_type = FakeArray()
                return self_type
        class FakeConfig:
            def validate(self):
                return True
        class FakeSherpa:
            @staticmethod
            def OfflineSpeakerDiarizationConfig(**_):
                return FakeConfig()
            @staticmethod
            def OfflineSpeakerSegmentationModelConfig(**_):
                return object()
            @staticmethod
            def OfflineSpeakerSegmentationPyannoteModelConfig(**_):
                return object()
            @staticmethod
            def SpeakerEmbeddingExtractorConfig(**_):
                return object()
            @staticmethod
            def FastClusteringConfig(**options):
                clustering_args.append(options)
                return object()
            @staticmethod
            def OfflineSpeakerDiarization(_config):
                class Diarizer:
                    sample_rate = 16000
                    def process(self, _samples):
                        class Result(list):
                            def sort_by_start_time(self):
                                return self
                        def segment(a, b, s):
                            return type("Segment", (), {"start": a, "end": b,
                                                         "speaker": s})()
                        return Result([segment(0, 1, 9), segment(1, 2, 3),
                                       segment(2, 3, 9)])
                return Diarizer()

        turns, speakers = voice.diarize(
            make_wav(), "dummy-seg", "dummy-emb",
            backend=FakeSherpa, numpy_module=FakeNumpy,
            cluster_threshold=0.65,
        )
        self.assertEqual(speakers, 2)
        self.assertEqual([t["speaker"] for t in turns],
                         ["speaker_0", "speaker_1", "speaker_0"])
        self.assertNotIn("9", str(turns))
        self.assertEqual(clustering_args, [{"num_clusters": -1, "threshold": 0.65}])


if __name__ == "__main__":
    unittest.main()
