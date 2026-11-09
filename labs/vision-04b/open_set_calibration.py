"""LUMIA VI-04C.1 — reproducible, CLOSED-DURING-PRODUCTION open-set QA.

No images, names, templates or personal identifiers are accepted here.
Only in-memory cosine distances to the enrolled SFace profile.
A good pilot score NEVER enables recognition, voice greetings or authentication.
"""
from __future__ import annotations

import math
from statistics import median
from typing import Mapping, Sequence

MIN_GENUINE = 6
MIN_UNKNOWN_GROUPS = 3
MIN_UNKNOWN_PER_GROUP = 4
MIN_TRAIN_SEPARATION = 0.06  # experimental heuristic, NOT a published SFace acceptance threshold


class CalibrationError(Exception):
    pass


def validate_distances(values: Sequence[float]) -> list[float]:
    if not isinstance(values, (list, tuple)):
        raise CalibrationError("Se necesita una colección de distancias.")
    checked: list[float] = []
    for value in values:
        if isinstance(value, bool):
            raise CalibrationError("Distancia no numérica.")
        try:
            score = float(value)
        except (TypeError, ValueError) as exc:
            raise CalibrationError("Distancia no numérica.") from exc
        if not math.isfinite(score) or not 0 <= score <= 2:
            raise CalibrationError("Las distancias coseno deben estar entre cero y dos.")
        checked.append(score)
    return checked


def _minmax(values: list[float]) -> dict[str, float]:
    return {
        "minimum": round(min(values), 6),
        "median": round(median(values), 6),
        "maximum": round(max(values), 6),
    }


def assess_open_set(
    genuine: Sequence[float],
    unknown_groups: Mapping[str, Sequence[float]],
) -> dict[str, object]:
    """Stratified alternate-sample calibration + holdout, never identity claims.

    Positive photos must NOT include enrollment images. Unknown groups must be
    different consenting adults, NOT multiple folders for the same person.
    Group names are used only for splitting in memory and never emitted.
    """
    g = validate_distances(genuine)
    if len(g) < MIN_GENUINE:
        raise CalibrationError(f"Se necesitan al menos {MIN_GENUINE} fotos auténticas nuevas.")
    if not isinstance(unknown_groups, dict) or len(unknown_groups) < MIN_UNKNOWN_GROUPS:
        raise CalibrationError(f"Se necesitan {MIN_UNKNOWN_GROUPS} adultos distintos no registrados.")
    u_by_group: list[list[float]] = []
    for key, scores in unknown_groups.items():
        if not isinstance(key, str) or not key.strip():
            raise CalibrationError("Grupo de persona desconocida inválido.")
        validated = validate_distances(scores)
        if len(validated) < MIN_UNKNOWN_PER_GROUP:
            raise CalibrationError(
                f"Se necesitan al menos {MIN_UNKNOWN_PER_GROUP} imágenes por adulto desconocido."
            )
        u_by_group.append(validated)

    g_train, g_hold = g[::2], g[1::2]
    u_train = [value for vals in u_by_group for value in vals[::2]]
    u_hold = [value for vals in u_by_group for value in vals[1::2]]
    all_unknown = [value for vals in u_by_group for value in vals]
    separation = min(u_train) - max(g_train)
    if not math.isfinite(separation):
        raise CalibrationError("Separación de distancias inválida.")
    enough_gap = separation >= MIN_TRAIN_SEPARATION
    threshold = (max(g_train) + min(u_train)) / 2 if enough_gap else None
    # Assess on samples excluded from threshold selection, not on training data.
    false_accepts = sum(value <= threshold for value in u_hold) if threshold is not None else None
    false_rejects = sum(value > threshold for value in g_hold) if threshold is not None else None
    pilot_gate = (
        threshold is not None
        and false_accepts == 0
        and false_rejects == 0
    )

    return {
        "lab": "VISION-04C.1",
        "model": "SFace",
        "distance": "cosine_min_over_three_enrollment_templates",
        "known_subject_images": len(g),
        "unknown_subjects": len(u_by_group),
        "unknown_images": len(all_unknown),
        "calibration_samples": len(g_train) + len(u_train),
        "held_out_samples": len(g_hold) + len(u_hold),
        "genuine_distances": _minmax(g),
        "unknown_distances": _minmax(all_unknown),
        "calibration_gap": round(separation, 6),
        "gap_heuristic": MIN_TRAIN_SEPARATION,
        "candidate_threshold_only": round(threshold, 6) if threshold is not None else None,
        "held_out_false_accepts": false_accepts,
        "held_out_false_rejects": false_rejects,
        "held_out_unknown_count": len(u_hold),
        "held_out_genuine_count": len(g_hold),
        "pilot_separation_observed": pilot_gate,
        "recognition_enabled_in_lumia": False,
        "production_approved": False,
        "identity_confirmed": False,
        "warning": (
            "Pocos ejemplos NO establecen una tasa poblacional de error. "
            "El umbral es exploratorio y NO se guarda ni activa el reconocimiento."
        ),
    }
