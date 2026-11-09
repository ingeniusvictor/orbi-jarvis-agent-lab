"""VI-04C.1 calibration tests: entirely synthetic, NO private photographs."""
from __future__ import annotations

from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))

from open_set_calibration import (
    CalibrationError, assess_open_set, validate_distances,
    MIN_GENUINE,MIN_UNKNOWN_GROUPS,MIN_UNKNOWN_PER_GROUP,
)
from adult_vault import create_record
import calibrate_open_set as cli


def good_unknown() -> dict[str,list[float]]:
    return {
        "adult_test_a":[.40,.43,.42,.46],
        "adult_test_b":[.39,.44,.45,.48],
        "adult_test_c":[.41,.47,.43,.49],
    }


class SyntheticBackend:
    @staticmethod
    def represent(**_kwargs):
        # Synthetic unit vector; cannot encode anyone's real face.
        return [{"embedding":[1.0]+[0.0]*127}]


class OpenSetCalibrationTests(unittest.TestCase):
    def test_clean_disjoint_calibration_has_holdout_but_no_identity_unlock(self):
        result=assess_open_set([.13,.16,.18,.20,.19,.21],good_unknown())
        self.assertTrue(result["pilot_separation_observed"])
        self.assertIsNotNone(result["candidate_threshold_only"])
        self.assertEqual(result["held_out_false_accepts"],0)
        self.assertEqual(result["held_out_false_rejects"],0)
        self.assertFalse(result["production_approved"])
        self.assertFalse(result["recognition_enabled_in_lumia"])
        self.assertFalse(result["identity_confirmed"])
        self.assertEqual(result["unknown_subjects"],3)
        self.assertEqual(result["held_out_samples"],9)
        self.assertNotIn("adult_test_",str(result))
        self.assertEqual(result["known_subject_images"],MIN_GENUINE)

    def test_heldout_unknown_false_accept_blocks_pilot(self):
        groups=good_unknown()
        groups["adult_test_a"][1]=.10   # unknown photo in holdout
        result=assess_open_set([.13,.16,.18,.20,.19,.21],groups)
        self.assertFalse(result["pilot_separation_observed"])
        self.assertEqual(result["held_out_false_accepts"],1)
        self.assertFalse(result["production_approved"])

    def test_heldout_genuine_false_reject_blocks_pilot(self):
        result=assess_open_set([.13,.46,.18,.20,.19,.21],good_unknown())
        self.assertFalse(result["pilot_separation_observed"])
        self.assertEqual(result["held_out_false_rejects"],1)

    def test_overlapping_training_has_no_candidate_threshold(self):
        result=assess_open_set([.39,.41,.40,.42,.39,.41],good_unknown())
        self.assertIsNone(result["candidate_threshold_only"])
        self.assertIsNone(result["held_out_false_accepts"])
        self.assertFalse(result["pilot_separation_observed"])

    def test_reject_small_or_non_numeric_or_nonfinite_datasets(self):
        with self.assertRaises(CalibrationError):
            assess_open_set([.1]*5,good_unknown())
        with self.assertRaises(CalibrationError):
            assess_open_set([.1]*6,{"a":[.4]*4})
        with self.assertRaises(CalibrationError):
            assess_open_set([.1]*6,{"a":[.4]*4,"b":[.4]*4,"c":[.4]})
        for invalid in (float("nan"),float("inf"),-1,3,True,"none"):
            with self.assertRaises(CalibrationError):
                validate_distances([invalid])

    def test_consent_required_and_file_group_validation(self):
        with patch.object(cli.sys.stdin,"isatty",return_value=False):
            with self.assertRaises(CalibrationError):
                cli.confirmed()
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            g=root/"genuine"
            u=root/"unknown"
            g.mkdir()
            u.mkdir()
            for i in range(6):
                (g/(f"g_{i}.jpg")).write_bytes(b"g"+str(i).encode())
            for adult in ("a","b","c"):
                folder=u/adult
                folder.mkdir()
                for i in range(4):
                    (folder/(f"u_{i}.jpg")).write_bytes((adult+str(i)).encode())
            genuine,unknown=cli.collect_dataset(str(g),str(u))
            self.assertEqual(len(genuine),6)
            self.assertEqual(len(unknown),3)
            cli.ensure_no_duplicate_photos(genuine,unknown)
            (u/"b"/"u_1.jpg").write_bytes((g/"g_1.jpg").read_bytes())
            with self.assertRaises(CalibrationError):
                cli.ensure_no_duplicate_photos(genuine,unknown)
            self.assertEqual(MIN_UNKNOWN_GROUPS,3)
            self.assertEqual(MIN_UNKNOWN_PER_GROUP,4)

    def test_inference_outputs_only_summary_without_paths_labels_templates(self):
        record=create_record("Private adult",[[1.0]+[0.0]*127]*3)
        result=cli.score_dataset(record,["my-secret-a.jpg"]*6,{
            "secret-stranger-a":["a.jpg"]*4,
            "secret-stranger-b":["b.jpg"]*4,
            "secret-stranger-c":["c.jpg"]*4,
        },SyntheticBackend)
        output=str(result)
        self.assertFalse(result["production_approved"])
        self.assertFalse(result["recognition_enabled_in_lumia"])
        self.assertFalse(result["biometric_data_persisted_by_calibration"])
        self.assertNotIn("Private adult",output)
        self.assertNotIn("secret-stranger",output)
        self.assertNotIn("my-secret-a",output)
        self.assertNotIn("embedding",output)
        self.assertIn("elapsed_ms",result)

    def test_no_runtime_camera_connection(self):
        project=HERE.parents[1]
        app=(project/"src/App.tsx").read_text(encoding="utf8")
        self.assertNotIn("calibrate_open_set",app)
        self.assertNotIn("open_set_calibration",app)
        src=(HERE/"calibrate_open_set.py").read_text(encoding="utf8")
        self.assertNotIn("getUserMedia",src)
        self.assertNotIn("cv2.VideoCapture",src)
        self.assertNotIn("ollama",src.lower())
        self.assertNotIn("write_text(",src)


if __name__=="__main__":
    unittest.main()
