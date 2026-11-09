"""LUMIA VI-04B — opt-in adult face-pair verification *laboratory*.

Uses the user's pinned DeepFace fork with SFace/ONNX CPU. No camera access,
images saved by this program, identity database, or runtime integration.

This is a diagnostic, NOT proof of identity or an authentication factor.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import time
from typing import Any

MODEL_NAME = "SFace"
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class LabError(Exception):
    pass


def configure_cpu_environment() -> Path:
    """Set these before importing DeepFace/ONNX. Isolate model cache from LUMIA."""
    os.environ["DEEPFACE_BACKEND_ENGINE"] = "onnx"
    os.environ["DEEPFACE_ONNX_PROVIDERS"] = "cpu"
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
    root = (Path(os.environ.get("LOCALAPPDATA") or str(Path.home())) /
            "ORBI" / "LUMIA-FACE-LAB-VI04B").resolve()
    root.mkdir(parents=True, exist_ok=True)
    os.environ["DEEPFACE_HOME"] = str(root)
    return root


def validate_photo(raw: str) -> str:
    """Never copy, delete or modify the source photo."""
    photo = Path(raw).expanduser().resolve()
    if not photo.is_file():
        raise LabError("No existe el archivo de fotografía solicitado.")
    if photo.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise LabError("Formato no permitido (usa JPG, PNG o WebP).")
    if not (1 <= photo.stat().st_size <= MAX_FILE_BYTES):
        raise LabError("La fotografía supera el límite de 12 MB o está vacía.")
    return str(photo)


def extract_single_embedding(deepface: Any, photo: str) -> list[float]:
    """Abort if the source contains zero or multiple faces; never pick one."""
    result = deepface.represent(
        img_path=photo,
        model_name=MODEL_NAME,
        detector_backend="opencv",
        enforce_detection=True,
        align=True,
        anti_spoofing=False,
        max_faces=None,
        return_face=False,
    )
    if len(result) != 1:
        raise LabError("Se necesita exactamente un rostro en cada imagen.")
    vector = result[0].get("embedding")
    if vector is None:
        raise LabError("DeepFace no devolvió representación facial.")
    # Explicitly convert in memory. Do not serialize facial templates to files.
    dims = [float(n) for n in vector]
    if len(dims) != 128:
        raise LabError("Dimensión de SFace inesperada; no comparar.")
    return dims


def evaluate_pair(deepface: Any, image_a: str, image_b: str) -> dict[str, Any]:
    start = time.perf_counter()
    a = extract_single_embedding(deepface, image_a)
    b = extract_single_embedding(deepface, image_b)
    result = deepface.verify(
        img1_path=a,
        img2_path=b,
        model_name=MODEL_NAME,
        distance_metric="cosine",
        threshold=None,  # DeepFace model-specific threshold; calibration is pending.
        silent=True,
    )
    distance = float(result["distance"])
    threshold = float(result["threshold"])
    return {
        "mode": "offline-cpu-pair-lab",
        "model": MODEL_NAME,
        "match_candidate": bool(result["verified"]),
        "distance": round(distance, 5),
        "threshold": round(threshold, 5),
        "faces_per_image": 1,
        "elapsed_ms": round((time.perf_counter() - start) * 1000),
        "identity_confirmed": False,
        "calibrated_on_asus": False,
        "warning": "Coincidencia experimental. No prueba identidad ni vida real.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="VI-04B: comparación facial local, voluntaria, CPU")
    parser.add_argument("--doctor", action="store_true", help="Comprueba el entorno sin cargar fotos")
    parser.add_argument("--image-a", help="Fotografía autorizada de un adulto (primera)")
    parser.add_argument("--image-b", help="Fotografía autorizada de un adulto (segunda)")
    args = parser.parse_args(argv)
    if not args.doctor and (not args.image_a or not args.image_b):
        parser.error("Indica --image-a y --image-b, o solamente --doctor")
    if args.doctor and (args.image_a or args.image_b):
        parser.error("--doctor no debe recibir fotografías")
    configure_cpu_environment()
    try:
        if args.doctor:
            import importlib.util
            ready = importlib.util.find_spec("deepface") is not None
            print(json.dumps({
                "lab": "VISION-04B", "deepface_installed": ready,
                "engine": "onnx", "provider": "cpu", "camera": False,
                "data_persisted": False,
            }, ensure_ascii=False))
            return 0 if ready else 2
        # Validate both before importing a heavy ML runtime or downloading any weights.
        photo_a = validate_photo(args.image_a)
        photo_b = validate_photo(args.image_b)
        if photo_a == photo_b:
            raise LabError("Selecciona dos fotografías distintas para la prueba.")
        from deepface import DeepFace
        # All image bytes and embeddings remain within this process.
        result = evaluate_pair(DeepFace, photo_a, photo_b)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as err:
        # Do not print file paths, traceback, embeddings or raw image content.
        print(json.dumps({
            "lab": "VISION-04B", "ok": False,
            "error": type(err).__name__,
            "hint": "Comprueba el entorno, las imágenes (un solo rostro) y el modelo local.",
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
