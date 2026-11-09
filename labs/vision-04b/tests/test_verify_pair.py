"""Fast, model-free CI checks for the isolated VI-04B lab.

They test interface and privacy contracts with a fake DeepFace implementation.
They do NOT claim biometric accuracy or that the model runs on the ASUS.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "verify_pair.py"
spec = importlib.util.spec_from_file_location("vision04b_lab", SOURCE)
assert spec and spec.loader
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


class FakeDeepFace:
    calls = []

    @classmethod
    def represent(cls, **kwargs):
        cls.calls.append(("represent", kwargs))
        return [{"embedding": [0.08] * 128}]

    @classmethod
    def verify(cls, **kwargs):
        cls.calls.append(("verify", kwargs))
        return {"verified": False, "distance": 0.61, "threshold": 0.51}


class FaceLabContractTests(unittest.TestCase):
    def setUp(self):
        FakeDeepFace.calls = []

    def test_cpu_environment_only_and_separate_cache(self):
        with TemporaryDirectory() as directory:
            with patch.dict("os.environ", {"LOCALAPPDATA": directory}, clear=True):
                home = lab.configure_cpu_environment()
                import os
                self.assertEqual(os.environ["DEEPFACE_BACKEND_ENGINE"], "onnx")
                self.assertEqual(os.environ["DEEPFACE_ONNX_PROVIDERS"], "cpu")
                self.assertEqual(os.environ["CUDA_VISIBLE_DEVICES"], "-1")
                self.assertIn("LUMIA-FACE-LAB-VI04B", str(home))
                self.assertTrue(home.is_dir())

    def test_rejects_missing_or_disallowed_or_too_large(self):
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            with self.assertRaises(lab.LabError):
                lab.validate_photo(str(folder / "missing.jpg"))
            txt = folder / "not-a-photo.txt"
            txt.write_text("dummy")
            with self.assertRaises(lab.LabError):
                lab.validate_photo(str(txt))
            jpg = folder / "oversize.jpg"
            with jpg.open("wb") as f:
                f.seek(lab.MAX_FILE_BYTES)
                f.write(b"x")
            with self.assertRaises(lab.LabError):
                lab.validate_photo(str(jpg))

    def test_uses_single_face_and_cpu_sface_without_persisting_templates(self):
        out = lab.evaluate_pair(FakeDeepFace, "local-photo-a.jpg", "local-photo-b.jpg")
        self.assertEqual(out["model"], "SFace")
        self.assertFalse(out["match_candidate"])
        self.assertFalse(out["identity_confirmed"])
        self.assertFalse(out["calibrated_on_asus"])
        self.assertEqual(out["faces_per_image"], 1)
        self.assertNotIn("embedding", str(out).lower())
        self.assertNotIn("local-photo-a", str(out))
        rep = [args for call, args in FakeDeepFace.calls if call == "represent"]
        self.assertEqual(len(rep), 2)
        self.assertTrue(all(x["align"] and x["enforce_detection"] for x in rep))
        self.assertTrue(all(x["max_faces"] is None and not x["return_face"] for x in rep))
        verify = [args for call, args in FakeDeepFace.calls if call == "verify"][0]
        self.assertEqual(verify["model_name"], "SFace")
        self.assertEqual(verify["distance_metric"], "cosine")
        self.assertEqual(len(verify["img1_path"]), 128)
        self.assertEqual(len(verify["img2_path"]), 128)

    def test_rejects_zero_or_multiple_faces(self):
        class Zero:
            @staticmethod
            def represent(**_kwargs):
                return []

        class Two:
            @staticmethod
            def represent(**_kwargs):
                return [{"embedding": [0.1] * 128}, {"embedding": [0.2] * 128}]

        for engine in (Zero, Two):
            with self.assertRaises(lab.LabError):
                lab.extract_single_embedding(engine, "photo.jpg")

    def test_rejects_bad_embedding_size(self):
        class Bad:
            @staticmethod
            def represent(**_kwargs):
                return [{"embedding": [0.1] * 512}]

        with self.assertRaises(lab.LabError):
            lab.extract_single_embedding(Bad, "photo.jpg")


    def test_reports_no_face_and_photo_position_without_leaking_path(self):
        class FaceNotDetected(ValueError):
            pass
        class FaceMissing:
            @classmethod
            def represent(cls, **_kwargs):
                raise FaceNotDetected("Face could not be detected in C:/PRIVATE/secret-face.jpg")
        with self.assertRaises(lab.LabError) as cm:
            lab.extract_single_embedding(FaceMissing, "C:/PRIVATE/secret-face.jpg", photo_label="B")
        report = lab.safe_failure(cm.exception)
        self.assertEqual(report["error_code"], "NO_FACE_DETECTED")
        self.assertEqual(report["photo"], "B")
        self.assertNotIn("secret-face", str(report))
        self.assertNotIn("PRIVATE", str(report))

    def test_reports_multiple_faces_without_picking_one(self):
        class Two:
            @classmethod
            def represent(cls, **_kwargs):
                return [{"embedding": [1.] * 128}, {"embedding": [2.] * 128}]
        with self.assertRaises(lab.LabError) as cm:
            lab.extract_single_embedding(Two, "private_a.jpg", photo_label="A")
        self.assertEqual(lab.safe_failure(cm.exception)["error_code"], "MULTIPLE_FACES")
        self.assertEqual(lab.safe_failure(cm.exception)["photo"], "A")

    def test_sanitizes_underlying_model_crash(self):
        class Bad:
            @classmethod
            def represent(cls, **_kwargs):
                raise RuntimeError("private-photo-name.jpg: exact failure and private path")
        with self.assertRaises(lab.LabError) as cm:
            lab.extract_single_embedding(Bad, "private-photo-name.jpg", photo_label="A")
        report = lab.safe_failure(cm.exception)
        self.assertEqual(report["error_code"], "MODEL_RUNTIME_ERROR")
        self.assertNotIn("private-photo-name", str(report))
        self.assertNotIn("exact failure", str(report))

    def test_rejects_nan_inf_and_invalid_vectors(self):
        class Odd:
            @classmethod
            def represent(cls, **_kwargs):
                return [{"embedding": [1.0] * 127 + [float("nan")]}]
        with self.assertRaises(lab.LabError) as cm:
            lab.extract_single_embedding(Odd, "private.jpg", photo_label="B")
        self.assertEqual(lab.safe_failure(cm.exception)["error_code"], "BAD_EMBEDDING")

    def test_yunet_opt_in_preserves_single_face_and_cpu_settings(self):
        class Face:
            called = None
            @classmethod
            def represent(cls, **kwargs):
                cls.called = kwargs
                return [{"embedding": [1.] * 128}]
        lab.extract_single_embedding(Face, "photo.jpg", detector_backend="yunet")
        self.assertEqual(Face.called["detector_backend"], "yunet")
        self.assertIs(Face.called["enforce_detection"], True)
        self.assertIsNone(Face.called["max_faces"])
        self.assertIs(Face.called["return_face"], False)
        with self.assertRaises(lab.LabError):
            lab.extract_single_embedding(Face, "photo.jpg", detector_backend="skip")

    def test_missing_image_report_only_photo_slot_not_user_path(self):
        with self.assertRaises(lab.LabError) as cm:
            lab.validate_photo("C:/PRIVATE/facial-secret.jpg", "A")
        report = lab.safe_failure(cm.exception)
        self.assertEqual(report["photo"], "A")
        self.assertEqual(report["error_code"], "PHOTO_NOT_FOUND")
        self.assertNotIn("facial-secret", str(report))

    def test_failed_verify_is_sanitized_and_no_identity_claim(self):
        class BadVerification(FakeDeepFace):
            @classmethod
            def verify(cls, **_kwargs):
                raise RuntimeError("Patient folder C:/PRIVATE is sensitive")
        with self.assertRaises(lab.LabError) as cm:
            lab.evaluate_pair(BadVerification, "private_A.jpg", "private_B.jpg")
        report = lab.safe_failure(cm.exception)
        self.assertEqual(report["error_code"], "VERIFY_RUNTIME_ERROR")
        self.assertIsNone(report["photo"])
        self.assertNotIn("C:/PRIVATE", str(report))


if __name__ == "__main__":
    unittest.main()
