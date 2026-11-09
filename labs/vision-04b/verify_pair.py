"""LUMIA VI-04B — opt-in adult face-pair verification *laboratory*.

Uses the user's pinned DeepFace fork with SFace/ONNX CPU. No camera access,
images saved by this program, identity database, or runtime integration.

This is a diagnostic, NOT proof of identity or an authentication factor.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import sys
import time
from typing import Any

MODEL_NAME = "SFace"
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class LabError(Exception):
    """Only safe structured failure categories, never raw private image paths."""

    def __init__(self, message: str, *, code: str = "LAB_VALIDATION_ERROR", photo: str | None = None):
        super().__init__(message)
        self.code = code
        self.photo = photo if photo in ("A", "B") else None


def safe_failure(err: Exception) -> dict[str, Any]:
    """Output strictly allowlisted keys; DeepFace exception messages can contain paths."""
    if isinstance(err, LabError):
        code, photo = err.code, err.photo
    else:
        code, photo = "LIBRARY_OR_MODEL_ERROR", None
    tips = {
        "PHOTO_NOT_FOUND": "Selecciona una fotografía existente en la ASUS.",
        "PHOTO_UNSUPPORTED": "Solo se admite JPG, JPEG, PNG o WebP.",
        "PHOTO_SIZE_INVALID": "Usa una foto entre 1 byte y 12 MB.",
        "SAME_IMAGE": "Elige dos fotografías diferentes.",
        "SAME_IMAGE_CONTENT": "Las fotos A y B tienen exactamente el mismo contenido; elige dos capturas distintas.",
        "NO_FACE_DETECTED": "El detector no encontró rostro frontal; prueba otra foto o --detector-backend yunet.",
        "MULTIPLE_FACES": "Hay más de un rostro visible; usa una foto con una sola persona.",
        "BAD_EMBEDDING": "SFace no devolvió exactamente 128 valores numéricos finitos.",
        "MODEL_RUNTIME_ERROR": "Falló el detector o SFace; verifica pesos y dependencias locales.",
        "VERIFY_RUNTIME_ERROR": "Falló la comparación de embeddings; revisa el entorno local.",
        "CROP_CANCELLED": "Se canceló la selección manual. No se procesó esa foto.",
        "CROP_TOO_SMALL": "Selecciona un recuadro que abarque frente, ojos y mentón.",
        "CROP_INVALID": "El recuadro no es válido; inténtalo nuevamente.",
        "PHOTO_READ_ERROR": "No se pudo abrir esta fotografía para recorte.",
        "PHOTO_TOO_LARGE": "La imagen supera el límite de píxeles del recorte.",
        "GUI_UNAVAILABLE": "No se pudo iniciar la ventana de recorte en Windows.",
    }
    return {
        "lab": "VISION-04B",
        "ok": False,
        "error_code": code,
        "photo": photo,
        "hint": tips.get(code, "Revisa la instalación y el diagnóstico local."),
        "privacy": "Sin rutas, nombres, fotos ni embeddings en el diagnóstico.",
    }


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


def validate_photo(raw: str, photo_label: str | None = None) -> str:
    """Never copy, delete or modify the source photo."""
    photo = Path(raw).expanduser().resolve()
    if not photo.is_file():
        raise LabError("No existe el archivo.", code="PHOTO_NOT_FOUND", photo=photo_label)
    if photo.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise LabError("Formato no permitido.", code="PHOTO_UNSUPPORTED", photo=photo_label)
    if not (1 <= photo.stat().st_size <= MAX_FILE_BYTES):
        raise LabError("Tamaño inválido.", code="PHOTO_SIZE_INVALID", photo=photo_label)
    return str(photo)


def ensure_distinct_photo_content(photo_a: str, photo_b: str) -> None:
    """Compare source file bytes before any cropping/model work; never expose hashes.

    Different paths do NOT guarantee different photographs: Windows users can
    select copies under separate names. SHA256 is a strict exact-duplicate gate,
    not a perceptual similarity or identity test.
    """
    def fingerprint(photo: str) -> bytes:
        digest = sha256()
        try:
            with open(photo, "rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
        except OSError:
            raise LabError("No se pudo leer una fotografía.", code="PHOTO_READ_ERROR") from None
        return digest.digest()

    if fingerprint(photo_a) == fingerprint(photo_b):
        raise LabError("Se eligió la misma imagen.", code="SAME_IMAGE_CONTENT")


def extract_single_embedding(
    deepface: Any,
    photo: str,
    detector_backend: str = "opencv",
    photo_label: str | None = None,
) -> list[float]:
    """Require exactly one genuine detection, never silently use a whole image."""
    if detector_backend not in ("opencv", "yunet"):
        raise LabError("Detector no autorizado.", code="MODEL_RUNTIME_ERROR", photo=photo_label)
    try:
        result = deepface.represent(
            img_path=photo,
            model_name=MODEL_NAME,
            detector_backend=detector_backend,
            enforce_detection=True,  # NEVER switch to False: it fabricates a whole-image face
            align=True,
            anti_spoofing=False,
            max_faces=None,          # NEVER truncate multiple faces to one
            return_face=False,
        )
    except Exception as err:
        # DeepFace FaceNotDetected includes an absolute photo path in its message.
        # Classify only by the typed exception name; never echo str(err).
        category = type(err).__name__
        if category == "FaceNotDetected":
            raise LabError("No hubo detección facial.", code="NO_FACE_DETECTED", photo=photo_label) from None
        raise LabError("Fallo de modelo o imagen.", code="MODEL_RUNTIME_ERROR", photo=photo_label) from None

    if not isinstance(result, list) or len(result) != 1:
        code = "NO_FACE_DETECTED" if isinstance(result, list) and len(result) == 0 else "MULTIPLE_FACES"
        raise LabError("Se requiere exactamente un rostro.", code=code, photo=photo_label)
    if not isinstance(result[0], dict):
        raise LabError("Salida SFace inválida.", code="BAD_EMBEDDING", photo=photo_label)
    vector = result[0].get("embedding")
    try:
        dims = [float(n) for n in vector]
    except (TypeError, ValueError, OverflowError):
        raise LabError("Vector inválido.", code="BAD_EMBEDDING", photo=photo_label) from None
    if len(dims) != 128 or any(not math.isfinite(n) for n in dims):
        raise LabError("Vector no válido.", code="BAD_EMBEDDING", photo=photo_label)
    return dims


def evaluate_pair(
    deepface: Any,
    image_a: str,
    image_b: str,
    detector_backend: str = "opencv",
) -> dict[str, Any]:
    start = time.perf_counter()
    a = extract_single_embedding(deepface, image_a, detector_backend, "A")
    b = extract_single_embedding(deepface, image_b, detector_backend, "B")
    try:
        result = deepface.verify(
            img1_path=a,
            img2_path=b,
            model_name=MODEL_NAME,
            distance_metric="cosine",
            threshold=None,  # Model default: NOT calibrated for ASUS
            silent=True,
        )
        distance = float(result["distance"])
        threshold = float(result["threshold"])
        matched = bool(result["verified"])
        if not math.isfinite(distance) or not math.isfinite(threshold):
            raise ValueError("Non-finite verification result.")
    except Exception:
        raise LabError("No se pudo comparar.", code="VERIFY_RUNTIME_ERROR") from None
    return {
        "mode": "offline-cpu-pair-lab",
        "model": MODEL_NAME,
        "detector": detector_backend,
        "match_candidate": matched,
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
    parser.add_argument("--manual-crop-a", action="store_true",
                        help="Seleccionar con mouse un SOLO rostro en A; recorte solo RAM")
    parser.add_argument("--manual-crop-b", action="store_true",
                        help="Seleccionar con mouse un SOLO rostro en B; recorte solo RAM")
    parser.add_argument(
        "--detector-backend", choices=("opencv", "yunet"), default="opencv",
        help="opencv=Haar inicial; yunet=alternativa OpenCV ONNX para rostros difíciles",
    )
    args = parser.parse_args(argv)
    if not args.doctor and (not args.image_a or not args.image_b):
        parser.error("Indica --image-a y --image-b, o solamente --doctor")
    if args.doctor and (args.image_a or args.image_b or args.manual_crop_a or args.manual_crop_b):
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
        photo_a = validate_photo(args.image_a, "A")
        photo_b = validate_photo(args.image_b, "B")
        if photo_a == photo_b:
            raise LabError("Selecciona dos fotografías distintas.", code="SAME_IMAGE")
        ensure_distinct_photo_content(photo_a, photo_b)
        if args.manual_crop_a or args.manual_crop_b:
            from face_crop_gui import CropError, choose_face_crop
            def choose(photo_path: str, slot: str):
                try:
                    return choose_face_crop(photo_path, slot)
                except CropError as exc:
                    raise LabError("Recorte interrumpido.", code=exc.code, photo=slot) from None
            if args.manual_crop_a:
                photo_a = choose(photo_a, "A")
            if args.manual_crop_b:
                photo_b = choose(photo_b, "B")
        from deepface import DeepFace
        # A manual crop is a BGR numpy image, not a new file. Detection is mandatory.
        result = evaluate_pair(DeepFace, photo_a, photo_b, args.detector_backend)
        result["manual_crop_a"] = bool(args.manual_crop_a)
        result["manual_crop_b"] = bool(args.manual_crop_b)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as err:
        # Do not print file paths, traceback, embeddings or raw image content.
        print(json.dumps(safe_failure(err), ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
