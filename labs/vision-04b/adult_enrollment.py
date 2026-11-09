"""VI-04C.0: local opt-in adult enrollment pilot; NEVER runs with LUMIA.

No camera access and no automatic identity decisions. Use only consented adult
photos outside the repository. DeepFace remains CPU ONNX; only an encrypted
current-user DPAPI vault (not photos or raw embeddings) is retained on disk.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

from adult_vault import (
    VaultError,
    WindowsDpapi,
    create_record,
    default_vault_path,
    delete_record,
    evaluate_probe,
    load,
    save_new,
)
from verify_pair import LabError, configure_cpu_environment, extract_single_embedding, validate_photo
from face_crop_gui import CropError, choose_face_crop

ADULT_CONSENT_PHRASE = "ACEPTO REGISTRAR MI ROSTRO"
DELETION_PHRASE = "ELIMINAR REGISTRO FACIAL"


def confirmed(phrase: str, request: str) -> None:
    if not sys.stdin.isatty():
        raise VaultError("Se requiere confirmación interactiva local. No se admite CI o ejecución automática.")
    response = input(request + "\nEscribe exactamente: " + phrase + "\n> ")
    if response.strip() != phrase:
        raise VaultError("Operación cancelada: confirmación no recibida.")


def check_photos(paths: list[str]) -> list[str]:
    if len(paths) != 3:
        raise VaultError("Se requieren exactamente tres imágenes distintas de la misma persona adulta.")
    validated = [validate_photo(p) for p in paths]
    if len(set(validated)) != 3:
        raise VaultError("Las tres fotografías deben ser archivos diferentes.")
    # Also reject byte-identical copies under different names.
    from hashlib import sha256
    hashes = []
    for path in validated:
        h = sha256()
        with open(path, "rb") as image:
            for chunk in iter(lambda: image.read(1024 * 1024), b""):
                h.update(chunk)
        hashes.append(h.digest())
    if len(set(hashes)) != 3:
        raise VaultError("Se necesitan fotografías diferentes, no copias idénticas.")
    return validated


def command_enroll(args: Any, path: Path, cipher: WindowsDpapi) -> dict[str, Any]:
    if path.exists():
        raise VaultError("Ya existe un perfil facial. No se sobrescribirá.")
    validated = check_photos(args.photos)
    confirmed(
        ADULT_CONSENT_PHRASE,
        "Solo adultos: confirmo que son fotos mías o de un adulto con consentimiento explícito. "
        "Se guardarán tres plantillas faciales CIFRADAS con DPAPI, no fotos. "
        "El registro no demuestra identidad ni permite reconocer personas automáticamente.",
    )
    from deepface import DeepFace
    # Human selects a region only when explicitly requested. Never persist crops.
    embeddings = []
    for index, photo in enumerate(validated, start=1):
        image = choose_face_crop(photo, f"REGISTRO {index}/3") if args.manual_crop else photo
        embeddings.append(
            extract_single_embedding(
                DeepFace, image,
                detector_backend=args.detector_backend,
                photo_label=None,
            )
        )
    record = create_record(args.label, embeddings)
    save_new(path, record, cipher)
    return {
        "mode": "offline-enrollment-lab",
        "saved_encrypted": True,
        "templates": 3,
        "photos_saved": False,
        "camera_active": False,
        "model": "SFace",
        "recognition_enabled_in_lumia": False,
        "calibrated": False,
    }


def command_probe(args: Any, path: Path, cipher: WindowsDpapi) -> dict[str, Any]:
    photo = validate_photo(args.photo)
    record = load(path, cipher)
    from deepface import DeepFace
    embedding = extract_single_embedding(DeepFace, photo)
    return evaluate_probe(record, embedding)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LUMIA VI-04C.0: registro adulto protegido, SOLO laboratorio")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor", help="Comprueba DPAPI y entorno (sin fotos)")
    sub.add_parser("status", help="¿Existe galería protegida? No imprime rostros.")
    enroll = sub.add_parser("enroll", help="Registrar un adulto con 3 imágenes autorizadas")
    enroll.add_argument("--label", required=True, help="Apodo local autorizado, no se imprime")
    enroll.add_argument("--photos", nargs=3, required=True, metavar="FOTO")
    probe = sub.add_parser("probe", help="Probar foto sin declarar identidades")
    enroll.add_argument(
        "--manual-crop", action="store_true",
        help="Elegir una cara con el mouse en cada foto, solo RAM (requiere consentimiento)"
    )
    enroll.add_argument(
        "--detector-backend", choices=("opencv", "yunet"), default="opencv",
        help="Detector facial, mantiene enforce_detection=True"
    )
    probe.add_argument("--photo", required=True)
    sub.add_parser("forget", help="Eliminar voluntariamente el registro cifrado")
    args = parser.parse_args(argv)
    configure_cpu_environment()
    try:
        path = default_vault_path()
        cipher = WindowsDpapi()
        if args.command == "doctor":
            payload = b"LUMIA-04C-DPAPI-CANARY"
            sealed = cipher.encrypt(payload)
            if sealed == payload or cipher.decrypt(sealed) != payload:
                raise VaultError("DPAPI no superó la prueba con datos sintéticos.")
            from importlib.util import find_spec
            result = {
                "lab": "VISION-04C0", "encryption": "Windows DPAPI/current user",
                "encryption_test": "PASS", "deepface_installed": find_spec("deepface") is not None,
                "vault_exists": path.is_file(), "webcam_enabled": False,
                "identity_recognition_enabled": False,
            }
        elif args.command == "status":
            result = {
                "lab": "VISION-04C0", "vault_exists": path.is_file(),
                "encrypted": True, "identity_recognition_enabled": False,
            }
        elif args.command == "enroll":
            result = command_enroll(args, path, cipher)
        elif args.command == "probe":
            result = command_probe(args, path, cipher)
        elif args.command == "forget":
            confirmed(
                DELETION_PHRASE,
                "Se eliminará el archivo del registro facial local. "
                "No se garantiza borrado físico de bloques anteriores en SSD.",
            )
            result = {"lab": "VISION-04C0", "deleted": delete_record(path)}
        else:
            raise VaultError("Operación desconocida.")
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as err:
        # DO NOT log labels, file paths, embeddings, stack traces or image bytes.
        code = err.code if isinstance(err, (CropError, LabError)) else type(err).__name__
        print(json.dumps({
            "lab": "VISION-04C0", "ok": False, "error_code": code,
            "hint": "Operación cancelada o entorno no preparado. Consulta el manual local.",
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
