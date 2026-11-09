"""VISION-04C.0 — Windows-only DPAPI encrypted, ONE ADULT profile laboratory.

The file is an opaque, current-Windows-user-protected blob. No photo is stored;
only three SFace normalized 128-d embeddings in encrypted JSON. This is not
authentication, face liveness, proof of identity, or camera identification.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import secrets
import sys
from typing import Any, Protocol, Sequence

DIMENSIONS = 128
TEMPLATE_COUNT = 3
MAX_VAULT_BYTES = 64 * 1024
MAGIC = b"LUMIA-FACE-04C0\x00"


class VaultError(Exception):
    pass


class Cipher(Protocol):
    def encrypt(self, payload: bytes) -> bytes: ...
    def decrypt(self, payload: bytes) -> bytes: ...


def default_vault_path() -> Path:
    # Intentionally Windows-only: DPAPI ties the vault to the Windows account.
    if os.name != "nt":
        raise VaultError("El registro facial protegido solo está habilitado en Windows.")
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        raise VaultError("LOCALAPPDATA no está disponible; no se crea ninguna galería.")
    return Path(base).resolve() / "ORBI" / "LUMIA-FACE-LAB-VI04B" / "adult-vault.dpapi"


class _Blob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _to_blob(raw: bytes) -> tuple[_Blob, Any]:
    # Keep ctypes backing memory alive for the duration of the native call.
    buffer = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    return _Blob(len(raw), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))), buffer


class WindowsDpapi:
    """CryptProtectData/CryptUnprotectData, current-user scope, no key files."""
    def __init__(self) -> None:
        if sys.platform != "win32":
            raise VaultError("DPAPI requiere Windows; se rechaza guardar datos sin cifrar.")
        crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        ptr = ctypes.POINTER(_Blob)
        crypt32.CryptProtectData.argtypes = [
            ptr, wintypes.LPCWSTR, ptr, ctypes.c_void_p, ctypes.c_void_p,
            wintypes.DWORD, ptr,
        ]
        crypt32.CryptProtectData.restype = wintypes.BOOL
        crypt32.CryptUnprotectData.argtypes = [
            ptr, ctypes.c_void_p, ptr, ctypes.c_void_p, ctypes.c_void_p,
            wintypes.DWORD, ptr,
        ]
        crypt32.CryptUnprotectData.restype = wintypes.BOOL
        kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        kernel32.LocalFree.restype = ctypes.c_void_p
        self._crypt32 = crypt32
        self._kernel32 = kernel32

    def _apply(self, raw: bytes, decrypt: bool) -> bytes:
        src, keep_alive = _to_blob(raw)
        dest = _Blob()
        operation = (self._crypt32.CryptUnprotectData if decrypt
                     else self._crypt32.CryptProtectData)
        if decrypt:
            args = (ctypes.byref(src), None, None, None, None, 1, ctypes.byref(dest))
        else:
            args = (ctypes.byref(src), "LUMIA adult face lab", None, None, None, 1,
                    ctypes.byref(dest))
        if not operation(*args):
            raise VaultError("Windows no pudo proteger o descifrar el registro facial.")
        try:
            return ctypes.string_at(dest.pbData, dest.cbData)
        finally:
            self._kernel32.LocalFree(ctypes.cast(dest.pbData, ctypes.c_void_p))
            del keep_alive

    def encrypt(self, payload: bytes) -> bytes:
        return self._apply(payload, False)

    def decrypt(self, payload: bytes) -> bytes:
        return self._apply(payload, True)


def normalize_vector(data: Sequence[float]) -> list[float]:
    if len(data) != DIMENSIONS:
        raise VaultError("La dimensión SFace debe ser 128.")
    floats = [float(n) for n in data]
    if any(not math.isfinite(n) or abs(n) > 1_000_000 for n in floats):
        raise VaultError("Representación facial inválida.")
    norm = math.sqrt(sum(n*n for n in floats))
    if norm < 1e-9:
        raise VaultError("Representación facial sin señal.")
    return [n / norm for n in floats]


def cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
    x = normalize_vector(a)
    y = normalize_vector(b)
    return max(0.0, min(2.0, 1.0 - sum(u*v for u, v in zip(x, y))))


def validate_label(label: str) -> str:
    text = label.strip()
    # A short, consented display label. No arbitrary HTML/control characters.
    if not 2 <= len(text) <= 64 or not re.fullmatch(
        r"[\wÀ-ÿ][\wÀ-ÿ .'-]{1,63}", text, flags=re.UNICODE
    ):
        raise VaultError("Usa una etiqueta de entre 2 y 64 caracteres, sin símbolos.")
    return text


def create_record(label: str, embeddings: Sequence[Sequence[float]]) -> dict[str, Any]:
    if len(embeddings) != TEMPLATE_COUNT:
        raise VaultError("Se requieren exactamente tres fotografías distintas de un adulto.")
    return {
        "schema": 1,
        "model": "SFace",
        "label": validate_label(label),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "adult_consent": True,
        "templates": [normalize_vector(v) for v in embeddings],
    }


def check_record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("schema") != 1 or value.get("model") != "SFace":
        raise VaultError("Formato de registro facial inválido.")
    if value.get("adult_consent") is not True:
        raise VaultError("Registro sin consentimiento verificable.")
    validate_label(value.get("label", ""))
    templates = value.get("templates")
    if not isinstance(templates, list) or len(templates) != TEMPLATE_COUNT:
        raise VaultError("Registro facial incompleto.")
    for vector in templates:
        normalize_vector(vector)
    return value


def save_new(vault: Path, record: dict[str, Any], cipher: Cipher) -> None:
    """Create once; fail if already enrolled. Never silently replace a profile."""
    check_record(record)
    if vault.exists() or vault.is_symlink():
        raise VaultError("Ya existe un perfil; elimínalo explícitamente antes de reemplazar.")
    vault.parent.mkdir(parents=True, exist_ok=True)
    # Reject a symlinked parent to avoid following an unexpected vault location.
    if vault.parent.is_symlink():
        raise VaultError("La carpeta de registro no debe ser un enlace simbólico.")
    payload = json.dumps(record, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encrypted = cipher.encrypt(payload)
    if len(encrypted) < 32 or len(encrypted) > MAX_VAULT_BYTES:
        raise VaultError("No se pudo validar el archivo cifrado.")
    target = MAGIC + encrypted
    # Exclusive create prevents overwriting an existing enrolment. No plaintext
    # temporary file exists, even briefly.
    with vault.open("xb") as file:
        file.write(target)


def load(vault: Path, cipher: Cipher) -> dict[str, Any]:
    if vault.is_symlink() or not vault.is_file():
        raise VaultError("No existe un perfil de adulto registrado.")
    if vault.stat().st_size > MAX_VAULT_BYTES + len(MAGIC):
        raise VaultError("El archivo protegido excede el tamaño permitido.")
    data = vault.read_bytes()
    if not data.startswith(MAGIC):
        raise VaultError("El registro no tiene el formato esperado.")
    try:
        record = json.loads(cipher.decrypt(data[len(MAGIC):]).decode("utf-8"))
    except Exception as err:
        raise VaultError("No se pudo descifrar el registro de este usuario Windows.") from err
    return check_record(record)


def evaluate_probe(record: dict[str, Any], embedding: Sequence[float]) -> dict[str, Any]:
    """Diagnostics only, never an identity/name decision without calibrated QA."""
    check_record(record)
    v = normalize_vector(embedding)
    distances = sorted(cosine_distance(v, template) for template in record["templates"])
    return {
        "model": "SFace",
        "known_identity": False,
        "candidate": "needs_calibration",
        "distance_min": round(distances[0], 6),
        "distance_median": round(distances[1], 6),
        "distance_max": round(distances[2], 6),
        "reference_count": TEMPLATE_COUNT,
        "warning": "No hay umbral ni rechazo de desconocidos calibrados en ASUS.",
    }


def delete_record(vault: Path) -> bool:
    """Deletes the file reference; cannot guarantee secure erase on SSD."""
    if vault.is_symlink():
        raise VaultError("No se permite borrar a través de un enlace simbólico.")
    if not vault.exists():
        return False
    if not vault.is_file():
        raise VaultError("El registro no es un archivo normal.")
    vault.unlink()
    return True
