"""VISION-04C.0 safety tests — synthetic data only, no actual biometric samples."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from adult_vault import (
    VaultError, WindowsDpapi, create_record, cosine_distance, default_vault_path,
    delete_record, evaluate_probe, load, normalize_vector, save_new,
    validate_label,
)
import adult_enrollment as cli


class FakeCipher:
    """Reversible deterministic test stub; NOT a production encryptor."""
    def encrypt(self, payload: bytes) -> bytes:
        return b"FAKE-CIPHER-CI:" + bytes(x ^ 0xAA for x in payload)
    def decrypt(self, payload: bytes) -> bytes:
        if not payload.startswith(b"FAKE-CIPHER-CI:"):
            raise ValueError("bad fake payload")
        return bytes(x ^ 0xAA for x in payload[len(b"FAKE-CIPHER-CI:"):])


def embed(axis: int) -> list[float]:
    v = [0.0] * 128
    v[axis] = 1.0
    return v


class AdultEnrollmentContractTests(unittest.TestCase):
    def test_unit_vectors_and_cosine(self):
        self.assertAlmostEqual(cosine_distance(embed(0), embed(0)), 0)
        self.assertAlmostEqual(cosine_distance(embed(0), embed(1)), 1)
        self.assertAlmostEqual(cosine_distance(embed(0), [-x for x in embed(0)]), 2)
        self.assertAlmostEqual(sum(x*x for x in normalize_vector([2.0] + [0.0]*127)), 1.0)
        with self.assertRaises(VaultError):
            normalize_vector([1.0]*127)
        with self.assertRaises(VaultError):
            normalize_vector([float("nan")] + [1.0]*127)
        with self.assertRaises(VaultError):
            normalize_vector([0.0]*128)

    def test_label_and_one_adult_three_templates(self):
        for bad in ("", "A", "<script>", "A\nB", "x"*100):
            with self.assertRaises(VaultError):
                validate_label(bad)
        record = create_record("Persona adulta", [embed(0), embed(0), embed(0)])
        self.assertEqual(len(record["templates"]), 3)
        self.assertTrue(record["adult_consent"])
        with self.assertRaises(VaultError):
            create_record("Adulto", [embed(0), embed(0)])

    def test_dpapi_vault_never_writes_clear_vectors_or_name(self):
        with TemporaryDirectory() as directory:
            vault = Path(directory)/"profiles"/"adult-vault.dpapi"
            cipher = FakeCipher()
            record = create_record("Adulto piloto", [embed(0), embed(0), embed(0)])
            save_new(vault, record, cipher)
            blob = vault.read_bytes()
            self.assertIn(b"LUMIA-FACE-04C0", blob)  # public format prefix
            self.assertNotIn(b"Adulto piloto", blob)
            self.assertNotIn(b'"templates"', blob)
            self.assertEqual(load(vault, cipher)["label"], "Adulto piloto")
            with self.assertRaises(VaultError):
                save_new(vault, record, cipher)
            self.assertTrue(delete_record(vault))
            self.assertFalse(delete_record(vault))
            self.assertFalse(vault.exists())

    def test_probe_not_identity_even_on_exact_match(self):
        record = create_record("Propietario", [embed(0)]*3)
        result = evaluate_probe(record, embed(0))
        self.assertFalse(result["known_identity"])
        self.assertEqual(result["candidate"], "needs_calibration")
        self.assertEqual(result["distance_min"], 0)
        self.assertEqual(result["reference_count"], 3)
        self.assertNotIn("Propietario", str(result))
        negative = evaluate_probe(record, embed(1))
        self.assertAlmostEqual(negative["distance_min"], 1)
        self.assertFalse(negative["known_identity"])

    def test_three_photos_must_not_be_identical_copies(self):
        with TemporaryDirectory() as directory:
            originals = []
            for n in range(3):
                p = Path(directory)/(f"photo{n}.jpg")
                p.write_bytes(b"identical synthetic test image")
                originals.append(str(p))
            with self.assertRaises(VaultError):
                cli.check_photos(originals)
            with self.assertRaises(VaultError):
                cli.check_photos(originals[:2])

    def test_no_noninteractive_enrollment_or_deletion(self):
        with patch.object(cli.sys.stdin, "isatty", return_value=False):
            with self.assertRaises(VaultError):
                cli.confirmed(cli.ADULT_CONSENT_PHRASE, "test")
            with self.assertRaises(VaultError):
                cli.confirmed(cli.DELETION_PHRASE, "test")

    @unittest.skipUnless(sys.platform == "win32", "Windows-only DPAPI validation")
    def test_real_windows_dpapi_roundtrip_current_user(self):
        c = WindowsDpapi()
        synthetic = os.urandom(64)
        encrypted = c.encrypt(synthetic)
        self.assertNotEqual(encrypted, synthetic)
        self.assertEqual(c.decrypt(encrypted), synthetic)
        with TemporaryDirectory() as directory:
            vault = Path(directory)/"adult-vault.dpapi"
            record = create_record("Adulto prueba", [embed(0)]*3)
            save_new(vault, record, c)
            self.assertNotIn(b"Adulto prueba", vault.read_bytes())
            self.assertEqual(load(vault, c)["model"], "SFace")
            delete_record(vault)

    def test_process_exits_without_image_or_camera_on_nonwindows(self):
        if sys.platform == "win32":
            self.assertIn("LUMIA-FACE", str(default_vault_path()))
        else:
            with self.assertRaises(VaultError):
                default_vault_path()

    def test_runtime_still_not_connected(self):
        root = HERE.parents[1]
        app = (root/"src/App.tsx").read_text(encoding="utf8")
        hands = (root/"src/lib/hands.ts").read_text(encoding="utf8")
        self.assertNotIn("adult_enrollment", app)
        self.assertNotIn("adult_vault", app)
        self.assertIn("holdCamera", hands)
        script = (HERE/"adult_enrollment.py").read_text(encoding="utf8")
        self.assertNotIn("getUserMedia", script)
        self.assertNotIn("ollama", script.lower())
        self.assertNotIn("record_video", script)
        self.assertNotIn("from webcam", script)


if __name__ == "__main__":
    unittest.main()
