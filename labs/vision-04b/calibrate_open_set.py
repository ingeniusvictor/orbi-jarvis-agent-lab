"""VISION-04C.1 — local, consent-only SFace open-set calibration CLI.

Never runs automatically, never opens a camera, never saves templates,
distances, names, scores, identifiers or photographs. Only aggregate numbers
are sent to stdout during a deliberate local ASUS laboratory session.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
import time
from typing import Any

from adult_vault import WindowsDpapi, cosine_distance, default_vault_path, load
from open_set_calibration import (
    CalibrationError, MIN_GENUINE, MIN_UNKNOWN_GROUPS,
    MIN_UNKNOWN_PER_GROUP, assess_open_set,
)
from verify_pair import (
    ALLOWED_EXTENSIONS, LabError, configure_cpu_environment, extract_single_embedding,
    validate_photo,
)
from face_crop_gui import CropError, choose_face_crop

CONSENT_PHRASE = "ACEPTO CALIBRAR ROSTROS ADULTOS"
MAX_UNKNOWN_GROUPS = 12
MAX_IMAGES_PER_GROUP = 40


def _check_root(path: str) -> Path:
    root = Path(path).expanduser().absolute()
    if root.is_symlink() or not root.is_dir():
        raise CalibrationError("La carpeta de fotografías no es válida.")
    # Never read a dataset from a Git working tree (prevents accidental commits).
    project = Path(__file__).resolve().parents[2]
    if root == project or project in root.parents:
        raise CalibrationError("Guarda las fotos fuera del repositorio Git.")
    return root


def _photos(folder: Path) -> list[str]:
    pictures: list[str] = []
    for entry in sorted(folder.iterdir(),key=lambda x:x.name.lower()):
        if entry.is_symlink():
            raise CalibrationError("No se admiten enlaces a imágenes o carpetas.")
        if not entry.is_file():
            raise CalibrationError("Se esperan solo fotografías dentro de cada carpeta.")
        if entry.suffix.lower() not in ALLOWED_EXTENSIONS:
            raise CalibrationError("Carpeta contiene archivos que no son fotografías.")
        pictures.append(validate_photo(str(entry)))
        if len(pictures) > MAX_IMAGES_PER_GROUP:
            raise CalibrationError("Demasiadas fotografías; divide la prueba.")
    return pictures


def collect_dataset(genuine_dir: str, unknown_dir: str) -> tuple[list[str],dict[str,list[str]]]:
    genuine_root = _check_root(genuine_dir)
    unknown_root = _check_root(unknown_dir)
    if genuine_root == unknown_root:
        raise CalibrationError("Se necesitan carpetas independientes.")
    genuine = _photos(genuine_root)
    if len(genuine) < MIN_GENUINE:
        raise CalibrationError(f"Se necesitan al menos {MIN_GENUINE} fotos nuevas del adulto inscrito.")
    strangers: dict[str,list[str]] = {}
    for group in sorted(unknown_root.iterdir(),key=lambda x:x.name.lower()):
        if group.is_symlink() or not group.is_dir():
            raise CalibrationError("Cada adulto desconocido requiere una subcarpeta.")
        group_photos = _photos(group)
        if len(group_photos) < MIN_UNKNOWN_PER_GROUP:
            raise CalibrationError(f"Faltan fotos del adulto desconocido ({MIN_UNKNOWN_PER_GROUP} mínimas).")
        strangers[group.name] = group_photos
        if len(strangers)>MAX_UNKNOWN_GROUPS:
            raise CalibrationError("Se admiten hasta doce grupos de adultos desconocidos.")
    if len(strangers)<MIN_UNKNOWN_GROUPS:
        raise CalibrationError(f"Se necesitan al menos {MIN_UNKNOWN_GROUPS} adultos desconocidos.")
    return genuine,strangers


def _digest(path: str) -> bytes:
    result = sha256()
    with open(path,"rb") as photo:
        for block in iter(lambda:photo.read(1024*1024),b""):
            result.update(block)
    return result.digest()


def ensure_no_duplicate_photos(genuine: list[str], unknown: dict[str,list[str]]) -> None:
    seen: set[bytes] = set()
    for path in [*genuine,*(p for group in unknown.values() for p in group)]:
        digest = _digest(path)
        if digest in seen:
            raise CalibrationError("Hay fotografías idénticas en la prueba.")
        seen.add(digest)


def score_dataset(
    record: dict[str,Any],
    genuine: list[str],
    unknown: dict[str,list[str]],
    backend: Any,
    *,
    manual_crop: bool = False,
    detector_backend: str = "opencv",
) -> dict[str,object]:
    """In-memory embeddings only. The vault never leaves this process."""
    def score(path: str, slot: str) -> float:
        # The opt-in ROI is not persisted or transmitted and never bypasses
        # mandatory one-face detection within the selected rectangle.
        image = choose_face_crop(path, slot) if manual_crop else path
        vector = extract_single_embedding(
            backend, image, detector_backend=detector_backend,
        )
        return min(cosine_distance(vector,t) for t in record["templates"])
    start = time.perf_counter()
    genuine_scores = [
        score(path, f"CONOCIDO {i}/{len(genuine)}")
        for i, path in enumerate(genuine, start=1)
    ]
    unknown_scores = {
        group: [
            score(path, f"DESCONOCIDO {group_i}.{photo_i}/{len(paths)}")
            for photo_i, path in enumerate(paths, start=1)
        ]
        for group_i, (group, paths) in enumerate(unknown.items(), start=1)
    }
    result = assess_open_set(genuine_scores,unknown_scores)
    result["elapsed_ms"] = round((time.perf_counter()-start)*1000)
    result["camera_opened"] = False
    result["biometric_data_persisted_by_calibration"] = False
    return result


def confirmed() -> None:
    if not sys.stdin.isatty():
        raise CalibrationError("La calibración requiere una confirmación interactiva.")
    question=(
        "¿Confirmas que todas las fotos son de ADULTOS con su permiso expreso?\n"
        "El grupo principal es la persona previamente registrada; "
        "cada subcarpeta de desconocidos corresponde a OTRA persona adulta distinta.\n"
        "La prueba no permite autenticar ni activar reconocimiento automático.\n"
        "Escribe exactamente: "+CONSENT_PHRASE+"\n> "
    )
    if input(question).strip()!=CONSENT_PHRASE:
        raise CalibrationError("Consentimiento no confirmado.")


def main(argv: list[str]|None=None)->int:
    parser=argparse.ArgumentParser(description="LUMIA VI-04C.1: evaluar rechazo de desconocidos (CPU)")
    parser.add_argument("--genuine-dir",required=True,
                        help="Carpeta de fotos NUEVAS del adulto registrado (min. 6)")
    parser.add_argument("--unknown-dir",required=True,
                        help="Contiene tres o más carpetas, una por adulto desconocido")
    parser.add_argument("--manual-crop", action="store_true",
                        help="Seleccionar región facial en cada foto, exclusivamente RAM")
    parser.add_argument("--detector-backend", choices=("opencv", "yunet"), default="opencv")
    args=parser.parse_args(argv)
    try:
        genuine,unknown=collect_dataset(args.genuine_dir,args.unknown_dir)
        # Explicit consent BEFORE reading bytes, loading vault or running ML models.
        confirmed()
        ensure_no_duplicate_photos(genuine,unknown)
        configure_cpu_environment()
        record=load(default_vault_path(),WindowsDpapi())
        from deepface import DeepFace
        result=score_dataset(
            record, genuine, unknown, DeepFace,
            manual_crop=args.manual_crop,
            detector_backend=args.detector_backend,
        )
        print(json.dumps(result,ensure_ascii=False))
        return 0
    except Exception as err:
        # No photo paths, group names, labels or embeddings on stderr.
        code = err.code if isinstance(err, (CropError, LabError)) else type(err).__name__
        print(json.dumps({
            "lab":"VISION-04C.1","ok":False,"error_code":code,
            "hint":"Prueba local cancelada o datos insuficientes. Revisa el manual.",
        },ensure_ascii=False),file=sys.stderr)
        return 1


if __name__=="__main__":
    raise SystemExit(main())
