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


if __name__ == "__main__":
    unittest.main()
