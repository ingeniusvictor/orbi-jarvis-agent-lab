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
import voice01_review_gui as gui
import voice01k_similarity as similarity
import voice01l_stability as stability
import voice01m_ami_benchmark as benchmark


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

    def test_voice01j_review_label_contract(self):
        answers = gui.empty_answers()
        self.assertEqual(set(answers), set(gui.CHOICES))
        self.assertEqual(answers["audio2_c"], "pendiente")
        answers["audio2_c"] = "A"
        answers["audio3_c"] = "B"
        answers["audio3_d"] = "C"
        answers["audio2_overlap"] = "incierto"
        data = gui.review_payload(answers)
        self.assertEqual(data["lab"], "VOICE-01J")
        self.assertEqual(data["answers"], answers)
        self.assertFalse(data["audio_written"])
        self.assertFalse(data["microphone_enabled"])
        self.assertEqual(data["files_uploaded"], 0)
        text = gui.summary_text(answers)
        self.assertIn("Audio 3: D suena como: C", text)
        for wrong in (
                {"audio2_c": "A"},
                dict(answers, audio2_c="NombreReal"),
                dict(answers, audio2_overlap="yes"),
                ):
            with self.subTest(invalid=wrong):
                with self.assertRaises(ValueError):
                    gui.validate_answers(wrong)

    def test_voice01j_pending_fields_and_partial_clipboard_summary(self):
        answers = gui.empty_answers()
        answers["audio2_c"] = "incierto"
        answers["audio2_overlap"] = "si"
        self.assertEqual(gui.pending_questions(answers),
                         ["Audio 3: C suena como", "Audio 3: D suena como"])
        text = gui.summary_text(answers)
        self.assertIn("Audio 2: C suena como: incierto", text)
        self.assertIn("Audio 2: hay dos voces simultaneas: si", text)
        self.assertIn("Audio 3: C suena como: pendiente", text)
        self.assertIn("Audio 3: D suena como: pendiente", text)
        answers["audio3_c"] = "A"
        answers["audio3_d"] = "C"
        self.assertEqual(gui.pending_questions(answers), [])
        with self.assertRaises(ValueError):
            gui.pending_questions(dict(answers, audio3_c="named_person"))

    def test_voice01j_audio3_only_summary_is_scoped(self):
        answers = gui.empty_answers()
        answers["audio3_c"] = "A"
        answers["audio3_d"] = "incierto"
        self.assertEqual(gui.review_keys(audio3_only=True),
                         ("audio3_c", "audio3_d"))
        text = gui.summary_text(answers, audio3_only=True)
        self.assertIn("SOLO AUDIO 3", text.upper())
        self.assertIn("Audio 3: C suena como: A", text)
        self.assertIn("Audio 3: D suena como: incierto", text)
        self.assertNotIn("Audio 2:", text)
        # The original comprehensive review stays backward-compatible.
        self.assertIn("Audio 2: C suena como: pendiente",
                      gui.summary_text(answers))
        from contextlib import redirect_stdout
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(gui.main(["--doctor", "--audio3-only"]), 0)
        doctor = __import__("json").loads(output.getvalue())
        self.assertFalse(doctor["microphone_enabled"])

    def test_voice01k_cosine_pairs_are_anonymous_and_symmetric(self):
        vectors = {"A": [1.0, 0.0], "B": [0.0, 1.0],
                   "C": [0.8, 0.6], "D": [0.9, 0.435889894]}
        scores = similarity.pair_scores(vectors)
        self.assertEqual(len(scores), 6)
        self.assertEqual([item["pair"] for item in scores],
                         ["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"])
        self.assertEqual(scores[0]["cosine"], 0.0)
        self.assertAlmostEqual(similarity.cosine(vectors["A"], vectors["C"]),
                               similarity.cosine(vectors["C"], vectors["A"]))
        self.assertGreater(scores[2]["cosine"], scores[1]["cosine"])
        with self.assertRaises(similarity.SimilarityError):
            similarity.cosine([0.0, 0.0], [1.0, 0.0])
        with self.assertRaises(similarity.SimilarityError):
            similarity.cosine([float("nan")], [1.0])
        with self.assertRaises(similarity.SimilarityError):
            similarity.pair_scores({"A": [1.0], "B": [0.0]})

    def test_voice01k_doctor_and_consent_are_safe(self):
        from contextlib import redirect_stdout, redirect_stderr
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(similarity.main(["--doctor"]), 0)
        doctor = __import__("json").loads(output.getvalue())
        self.assertFalse(doctor["microphone_enabled"])
        self.assertEqual(doctor["files_written"], 0)
        with redirect_stderr(io.StringIO()) as errors:
            self.assertEqual(similarity.main([]), 1)
        self.assertIn("CONSENT_REQUIRED", errors.getvalue())

    def test_voice01l_windows_are_balanced_and_disjoint(self):
        plan = stability.validate_windows()
        self.assertEqual(len(plan), 8)
        self.assertEqual([name for name, _, _, _ in plan],
                         ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"])
        for name, group, start, end in plan:
            self.assertAlmostEqual(end - start, 1.5)
            self.assertEqual(name[0], group)
        for windows in (
            (*plan[:-1], ("D2", "D", 51, 52)),
            (*plan[:-1], ("D2", "D", 49.0, 50.5)),
            (*plan[:-1], ("D2", "D", 51.0, 54.0)),
            (*plan[:-1], ("D2", "D", float("nan"), 52.5)),
            (*plan[:-1], ("D1", "D", 51.0, 52.5)),
        ):
            with self.subTest(windows=windows[-1]):
                with self.assertRaises(stability.SimilarityError):
                    stability.validate_windows(windows)

    def test_voice01l_aggregates_only_28_cosine_values(self):
        vectors = {
            "A1": [1.0, 0.0], "A2": [0.98, 0.2],
            "B1": [0.0, 1.0], "B2": [-0.1, 0.995],
            "C1": [0.9, 0.4], "C2": [0.8, 0.6],
            "D1": [0.95, 0.3], "D2": [0.92, 0.39],
        }
        data = stability.aggregate_scores(vectors)
        self.assertEqual([x["group"] for x in data["within"]],
                         list("ABCD"))
        self.assertEqual(len(data["between"]), 6)
        self.assertEqual(sum(len(x["window_pairs"]) for x in data["between"]), 24)
        self.assertEqual([x["pair"] for x in data["between"]],
                         ["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"])
        self.assertGreater(data["comparisons"]["mean_ac_minus_ab"], 0)
        self.assertGreater(data["comparisons"]["mean_ad_minus_ab"], 0)
        self.assertGreater(data["comparisons"]["worst_ac_minus_best_ab"], 0)
        self.assertNotIn("vectors", data)
        with self.assertRaises(stability.SimilarityError):
            stability.aggregate_scores({"A1": [1.0]})

    def test_voice01l_doctor_and_consent_gate(self):
        from contextlib import redirect_stdout, redirect_stderr
        import json
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(stability.main(["--doctor"]), 0)
        doctor = json.loads(out.getvalue())
        self.assertEqual(doctor["window_count"], 8)
        self.assertEqual(doctor["equal_window_seconds"], 1.5)
        self.assertFalse(doctor["microphone_enabled"])
        self.assertFalse(doctor["network_enabled"])
        self.assertEqual(doctor["files_written"], 0)
        with redirect_stderr(io.StringIO()) as err:
            self.assertEqual(stability.main([]), 1)
        self.assertIn("CONSENT_REQUIRED", err.getvalue())

    def test_voice01m_crop_public_manual_rttm_anonymizes_labels(self):
        source = "\n".join([
            "SPEAKER ES2002a 1 59 3 <NA> <NA> human1 <NA> <NA>",
            "SPEAKER ES2002a 1 60.5 2 <NA> <NA> human2 <NA> <NA>",
            "SPEAKER ES2002a 1 100 1 <NA> <NA> human3 <NA> <NA>",
            "SPEAKER ES2002a 1 159.5 2 <NA> <NA> human4 <NA> <NA>",
            "SPEAKER ES2002a 1 200 2 <NA> <NA> human4 <NA> <NA>",
        ])
        raw, turns = benchmark.crop_manual_rttm(source)
        self.assertEqual(len(turns), 4)
        self.assertEqual({speaker for _, _, speaker in turns},
                         {"p0", "p1", "p2", "p3"})
        self.assertNotIn("human", raw)
        self.assertAlmostEqual(turns[0][0], 0.0)
        self.assertAlmostEqual(turns[0][1], 2.0)
        self.assertEqual(benchmark.parse_private_rttm(raw)[0][:2], (0.0, 2.0))

    def test_voice01m_overlap_metric_exact_perfect_swapped_labels(self):
        gold = [(0, 2, "p0"), (0.5, 1.5, "p1")]
        predicted = [(0, 2, "speaker_2"), (0.5, 1.5, "speaker_0")]
        stats = benchmark.score_intervals(gold, predicted, duration=2.0)
        self.assertEqual(stats["error_fraction"], 0)
        self.assertEqual(stats["reference_speakers"], 2)
        self.assertEqual(stats["predicted_speakers"], 2)
        self.assertEqual(stats["overlap_wallclock_seconds"], 1.0)
        self.assertEqual(stats["reference_speaker_seconds"], 3.0)
        self.assertEqual(stats["confusion_seconds"], 0)
        self.assertTrue(stats["overlap_included"])
        self.assertIn("not_official_DER", stats["metric"])

    def test_voice01m_metric_missed_overlap_and_false_alarm(self):
        gold = [(0, 2, "p0"), (1, 2, "p1")]
        pred = [(0, 2, "speaker_0")]
        score = benchmark.score_intervals(gold, pred, duration=2.0)
        self.assertEqual(score["miss_seconds"], 1.0)
        self.assertEqual(score["false_alarm_seconds"], 0.0)
        self.assertEqual(score["error_percent"], 33.333)
        single = benchmark.score_intervals(
            [(0, 1, "p0")], [(0, 2, "speaker_0")], duration=2.0)
        self.assertEqual(single["false_alarm_seconds"], 1.0)
        self.assertEqual(single["error_percent"], 100.0)
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.score_intervals([], [], duration=2.0)

    def test_voice01m_prepare_public_fixture_offline_and_checksum(self):
        import json
        from unittest.mock import patch
        full = make_wav(seconds=162)
        raw = "\n".join([
            "SPEAKER ES2002a 1 60 2 <NA> <NA> a <NA> <NA>",
            "SPEAKER ES2002a 1 66 2 <NA> <NA> b <NA> <NA>",
            "SPEAKER ES2002a 1 70 2 <NA> <NA> c <NA> <NA>",
            "SPEAKER ES2002a 1 80 2 <NA> <NA> d <NA> <NA>",
        ]).encode("utf-8")
        def mock_download(url, _limit):
            return full if url == benchmark.AUDIO_URL else raw
        with TemporaryDirectory() as folder:
            base = Path(folder)
            with patch.object(benchmark, "download_fixed", side_effect=mock_download) as downloader:
                stats = benchmark.prepare(base)
            self.assertEqual(downloader.call_count, 2)
            self.assertTrue(stats["ok"])
            self.assertFalse(stats["full_meeting_audio_saved"])
            self.assertFalse(stats["inference_executed"])
            wav, rttm, manifest = benchmark.locations(base)
            self.assertTrue(wav.is_file())
            self.assertTrue(rttm.is_file())
            self.assertTrue(manifest.is_file())
            self.assertEqual(wav.stat().st_size, 3_200_044)
            metadata = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(metadata["reference_speakers"], 4)
            self.assertFalse(metadata["source_original_audio_persisted"])
            self.assertNotIn("SPEAKER ES2002a", rttm.read_text(encoding="utf-8"))
            pcm, turns = benchmark.load_prepared(base)
            self.assertEqual(len(pcm), 3_200_000)
            self.assertEqual(len(turns), 4)
            self.assertEqual(len(list(base.rglob("*.wav"))), 1)
            with self.assertRaisesRegex(benchmark.BenchmarkError, "ALREADY_EXISTS"):
                benchmark.prepare(base)
            with rttm.open("a", encoding="utf-8") as stream:
                stream.write("unapproved change\n")
            with self.assertRaisesRegex(benchmark.BenchmarkError, "REFERENCE_MODIFIED"):
                benchmark.load_prepared(base)

    def test_voice01m_consent_no_network_and_doctor(self):
        import json
        from contextlib import redirect_stdout, redirect_stderr
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(benchmark.main(["--doctor"]), 0)
        doctor = json.loads(output.getvalue())
        self.assertFalse(doctor["network_used"])
        self.assertFalse(doctor["microphone_enabled"])
        self.assertEqual(doctor["files_written"], 0)
        with redirect_stderr(io.StringIO()) as errors:
            self.assertEqual(benchmark.main(["--run"]), 1)
        self.assertIn("CONSENT_REQUIRED", errors.getvalue())

    def test_voice01j_opt_in_json_save_only(self):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "reviews" / "test-review.json"
            with self.assertRaisesRegex(ValueError, "NOTHING_REVIEWED"):
                gui.save_review(gui.empty_answers(), target)
            self.assertFalse(target.exists())
            edited = gui.empty_answers()
            edited["audio2_c"] = "incierto"
            gui.save_review(edited, target)
            payload = __import__("json").loads(target.read_text(encoding="utf-8"))
            self.assertEqual(payload["answers"]["audio2_c"], "incierto")
            self.assertFalse(payload["audio_written"])
            self.assertEqual([p.name for p in target.parent.iterdir()],
                             ["test-review.json"])
            before = target.read_bytes()
            with self.assertRaises(FileExistsError):
                gui.save_review(dict(edited, audio2_c="A"), target)
            self.assertEqual(target.read_bytes(), before)

    def test_voice01j_rejects_unverified_wav(self):
        import hashlib
        from unittest.mock import patch
        audio = make_wav(seconds=1.0)
        digest = hashlib.sha256(audio).hexdigest().upper()
        manifest = {
            "public.wav": {
                "bytes": len(audio), "sha256": digest,
                "clips": [("A", 0.1, 0.5)],
            }
        }
        with TemporaryDirectory() as directory:
            file = Path(directory) / "public.wav"
            file.write_bytes(audio)
            with patch.dict(gui.EXPECTED, manifest, clear=True):
                pcm = gui.checked_public_audio(Path(directory))
                self.assertEqual(len(pcm["public.wav"]), 32000)
                file.write_bytes(audio[:-4] + b"\x00\x01\x02\x03")
                with self.assertRaisesRegex(ValueError, "SHA256"):
                    gui.checked_public_audio(Path(directory))

    def test_voice01j_doctor_never_starts_gui(self):
        from contextlib import redirect_stdout
        out = io.StringIO()
        with redirect_stdout(out):
            code = gui.main(["--doctor"])
        self.assertEqual(code, 0)
        payload = __import__("json").loads(out.getvalue())
        self.assertTrue(payload["user_save_required"])
        self.assertFalse(payload["microphone_enabled"])
        self.assertFalse(payload["network_enabled"])

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
