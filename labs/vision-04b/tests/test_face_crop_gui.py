"""Privacy and geometry contracts for optional *human*-selected in-RAM face crop.

No Tk window or real photographs are opened in CI.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location("face_crop_gui", ROOT / "face_crop_gui.py")
assert s and s.loader
crop = importlib.util.module_from_spec(s)
s.loader.exec_module(crop)


class FaceCropSafetyTests(unittest.TestCase):
    def test_user_selected_roi_maps_to_original_pixel_space(self):
        bounds = crop.selection_to_bounds(
            (110.0, 90.0), (550.0, 410.0),
            preview_size=(880, 550), original_size=(1920, 1200),
        )
        self.assertEqual(bounds, (240, 196, 1200, 895))
        self.assertGreaterEqual(bounds[2] - bounds[0], crop.MIN_CROP_SIDE)

    def test_reverse_drag_is_identical(self):
        forward = crop.selection_to_bounds(
            (100, 90), (550, 410),
            preview_size=(880, 550), original_size=(1920, 1200),
        )
        backward = crop.selection_to_bounds(
            (550, 410), (100, 90),
            preview_size=(880, 550), original_size=(1920, 1200),
        )
        self.assertEqual(forward, backward)

    def test_clamps_boundaries_and_rejects_too_small(self):
        self.assertEqual(
            crop.selection_to_bounds(
                (-50, -50), (999, 999),
                preview_size=(880, 550), original_size=(1920, 1200),
            ),
            (0, 0, 1920, 1200),
        )
        with self.assertRaises(crop.CropError) as cm:
            crop.selection_to_bounds(
                (0, 0), (5, 5),
                preview_size=(880, 550), original_size=(1920, 1200),
            )
        self.assertEqual(cm.exception.code, "CROP_TOO_SMALL")

    def test_nonfinite_and_zero_sizes_rejected(self):
        for bad in (float("nan"), float("inf")):
            with self.assertRaises(crop.CropError):
                crop.selection_to_bounds(
                    (bad, 20), (300, 300),
                    preview_size=(880, 550), original_size=(1920, 1200),
                )
        with self.assertRaises(crop.CropError):
            crop.selection_to_bounds(
                (0, 0), (200, 200),
                preview_size=(880, 550), original_size=(0, 1200),
            )

    def test_never_saves_crop_and_never_bypasses_detector(self):
        source = (ROOT / "face_crop_gui.py").read_text(encoding="utf-8")
        self.assertNotIn("cv2.imwrite", source)
        self.assertNotIn("np.save(", source)
        self.assertNotIn("Image.save(", source)
        self.assertNotIn("getUserMedia", source)
        self.assertNotIn("subprocess", source)
        self.assertNotIn("enforce_detection=False", source)
        verifier = (ROOT / "verify_pair.py").read_text(encoding="utf-8")
        self.assertIn("enforce_detection=True", verifier)
        self.assertIn("max_faces=None", verifier)
        self.assertIn("--manual-crop-a", verifier)
        self.assertIn("--manual-crop-b", verifier)


if __name__ == "__main__":
    unittest.main()
