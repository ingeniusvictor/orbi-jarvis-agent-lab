#!/usr/bin/env python3
"""VOICE-01J: private offline Windows GUI for human comparison of PUBLIC clips.

No microphone, network, recognition of real identities, audio export, or live
LUMIA integration. The operator decides whether to save a tiny local JSON
review and/or copy an anonymized summary to the clipboard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from voice01_listen import build_excerpt, load_public_pcm

EXPECTED = {
    "2-two-speakers-en.wav": {
        "bytes": 1088078,
        "sha256": "EE9C33D34E8F0FDA4B78277F609944A1565AA16E6E2146F4CB8F0EFB0D70030B",
        "clips": [
            ("A", 0.2, 2.5),
            ("B", 3.0, 6.5),
            ("C", 21.5, 26.5),
            ("Solapamiento", 17.5, 19.5),
        ],
    },
    "3-two-speakers-en.wav": {
        "bytes": 1753804,
        "sha256": "DD3CF2344F8410EE9A2E271E96D1C3F9B530F113AE5B47DEFECBC0D741A468E9",
        "clips": [
            ("A", 1.0, 6.0),
            ("B", 14.0, 20.0),
            ("C", 27.0, 30.0),
            ("D", 48.0, 53.0),
        ],
    },
}
CHOICES = {
    "audio2_c": ("pendiente", "A", "B", "otra", "incierto"),
    "audio2_overlap": ("pendiente", "si", "no", "incierto"),
    "audio3_c": ("pendiente", "A", "B", "otra", "incierto"),
    "audio3_d": ("pendiente", "A", "B", "C", "otra", "incierto"),
}
DESCRIPTIONS = {
    "audio2_c": "Audio 2: C suena como",
    "audio2_overlap": "Audio 2: hay dos voces simultaneas",
    "audio3_c": "Audio 3: C suena como",
    "audio3_d": "Audio 3: D suena como",
}
NO_AUDIO_SAVED = "Solo comparacion perceptual parcial; no es RTTM, DER ni identidad biometrica."


def empty_answers() -> dict[str, str]:
    return {key: "pendiente" for key in CHOICES}


def validate_answers(answers: dict[str, str]) -> dict[str, str]:
    if not isinstance(answers, dict) or set(answers) != set(CHOICES):
        raise ValueError("INVALID_ANSWER_KEYS")
    if any(answers[key] not in options for key, options in CHOICES.items()):
        raise ValueError("INVALID_ANSWER_VALUE")
    return dict(answers)


def pending_questions(answers: dict[str, str]) -> list[str]:
    checked = validate_answers(answers)
    return [DESCRIPTIONS[key] for key in CHOICES
            if checked[key] == "pendiente"]


def review_keys(audio3_only: bool = False) -> tuple[str, ...]:
    """Only the still-unanswered Audio 3 questions in guided mode."""
    return ("audio3_c", "audio3_d") if audio3_only else tuple(CHOICES)


def summary_text(answers: dict[str, str], audio3_only: bool = False) -> str:
    checked = validate_answers(answers)
    lines = [
        ("LUMIA VOICE-01J - Audio 3 - revision auditiva dirigida de WAV publicos"
         if audio3_only else
         "LUMIA VOICE-01J - revision auditiva local de WAV publicos"),
        "Evaluacion subjetiva; no verifica precision DER ni identidad personal.",
    ]
    lines.extend(
        f"{DESCRIPTIONS[key]}: {checked[key]}" for key in review_keys(audio3_only)
    )
    return "\n".join(lines)


def review_payload(answers: dict[str, str]) -> dict:
    checked = validate_answers(answers)
    return {
        "lab": "VOICE-01J",
        "review_type": "partial_human_listening",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source_files": {
            key: value["sha256"] for key, value in EXPECTED.items()
        },
        "answers": checked,
        "limit": NO_AUDIO_SAVED,
        "audio_written": False,
        "microphone_enabled": False,
        "files_uploaded": 0,
    }


def checked_public_audio(sample_dir: Path) -> dict[str, bytes]:
    result = {}
    for filename, expected in EXPECTED.items():
        path = sample_dir / filename
        if not path.is_file() or path.stat().st_size != expected["bytes"]:
            raise ValueError("PUBLIC_WAV_MISSING_OR_CHANGED:" + filename)
        if hashlib.sha256(path.read_bytes()).hexdigest().upper() != expected["sha256"]:
            raise ValueError("PUBLIC_WAV_SHA256_MISMATCH:" + filename)
        pcm, duration = load_public_pcm(str(path))
        for _, start, end in expected["clips"]:
            if not 0 <= start < end <= duration:
                raise ValueError("PUBLIC_CLIP_OUT_OF_RANGE")
        result[filename] = pcm
    return result


def save_review(answers: dict[str, str], target: Path) -> Path:
    checked = validate_answers(answers)
    if all(value == "pendiente" for value in checked.values()):
        raise ValueError("NOTHING_REVIEWED")
    # This explicit save writes ONLY annotations, not WAVs or embeddings.
    # Caller guarantees a file in the isolated local user data directory.
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise FileExistsError("REVIEW_ALREADY_EXISTS")
    with target.open("x", encoding="utf-8") as handle:
        json.dump(review_payload(checked), handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return target


def launch_gui(pcm: dict[str, bytes], out_dir: Path,
               audio3_only: bool = False):
    import tkinter as tk
    from tkinter import messagebox, ttk
    import winsound

    root = tk.Tk()
    root.title("LUMIA VOICE-01J | " +
               ("SOLO AUDIO 3" if audio3_only else "Revision auditiva offline"))
    root.geometry("770x720")
    root.minsize(650, 620)

    status = tk.StringVar(value="Listo. Reproduce los clips. No se graba audio.")
    answers = {name: tk.StringVar(value="pendiente") for name in CHOICES}
    keys = review_keys(audio3_only)
    progress = tk.StringVar()

    def update_progress(*_args):
        selected = {key: var.get() for key, var in answers.items()}
        missing = [key for key in keys if selected[key] == "pendiente"]
        progress.set(f"{len(keys) - len(missing)} de {len(keys)} respuestas. "
                     + ("Evaluacion completa." if not missing
                        else f"{len(missing)} pendientes (puedes copiar una revision parcial)."))

    for selection in answers.values():
        selection.trace_add("write", update_progress)

    top = ttk.Frame(root, padding=12)
    top.pack(fill="both", expand=True)
    ttk.Label(top, text=("VOICE-01J - SOLO AUDIO 3 (dos preguntas)"
                         if audio3_only else
                         "VOICE-01J - Comparar voces sin identificarlas"),
              font=("Segoe UI", 14, "bold")).pack(anchor="w")
    ttk.Label(
        top,
        text="Clips publicos, audio en memoria. A/B/C/D son etiquetas por archivo, NO nombres.",
        wraplength=725,
    ).pack(anchor="w", pady=(4, 10))

    book = ttk.Notebook(top)
    book.pack(fill="both", expand=True)

    def play(filename, name, start, end):
        status.set(f"Reproduciendo {filename}: {name} ({start:.1f}-{end:.1f} s)")
        root.update_idletasks()
        try:
            wav = build_excerpt(pcm[filename], start, end)
            winsound.PlaySound(wav, winsound.SND_MEMORY)
            status.set(f"Reproduccion completa: {name}.")
        except (RuntimeError, OSError, ValueError) as error:
            status.set("No se pudo reproducir el fragmento.")
            messagebox.showerror("Reproduccion fallida", str(error))

    def add_question(parent, key, prompt, options):
        ttk.Label(parent, text=prompt, wraplength=710).pack(anchor="w", pady=(12, 3))
        frame = ttk.Frame(parent)
        frame.pack(anchor="w", fill="x")
        for val, label in options:
            ttk.Radiobutton(frame, text=label, value=val,
                            variable=answers[key]).pack(side="left", padx=(0, 13))

    def create_tab(filename, title):
        tab = ttk.Frame(book, padding=12)
        book.add(tab, text=title)
        ttk.Label(tab, text=title, font=("Segoe UI", 11, "bold")).pack(anchor="w")
        ttk.Label(tab, text="Escucha cada clip y compara el timbre de voz. "
                  "Puedes seleccionar Incierto si no lo distingues.",
                  wraplength=680).pack(anchor="w", pady=(3, 8))
        for name, start, end in EXPECTED[filename]["clips"]:
            ttk.Button(
                tab, text=f"Reproducir {name} - {start:.1f} a {end:.1f} s",
                command=lambda f=filename, n=name, a=start, b=end: play(f, n, a, b),
            ).pack(fill="x", pady=2)
        return tab

    if not audio3_only:
        audio2 = create_tab("2-two-speakers-en.wav", "Audio 2 - tres grupos")
        add_question(audio2, "audio2_c", "¿La voz de C coincide con A o B?",
                     [("A", "A"), ("B", "B"), ("otra", "Otra"), ("incierto", "Incierto")])
        add_question(audio2, "audio2_overlap",
                     "En el clip de solapamiento: ¿se escuchan dos personas al mismo tiempo?",
                     [("si", "Si"), ("no", "No"), ("incierto", "Incierto")])

    audio3 = create_tab("3-two-speakers-en.wav", "Audio 3 - cuatro clips")
    add_question(audio3, "audio3_c", "¿La voz de C coincide con A o B?",
                 [("A", "A"), ("B", "B"), ("otra", "Otra"), ("incierto", "Incierto")])
    add_question(audio3, "audio3_d", "¿La voz de D coincide con alguna anterior?",
                 [("A", "A"), ("B", "B"), ("C", "C"), ("otra", "Otra"),
                  ("incierto", "Incierto")])

    ttk.Label(top, textvariable=progress, wraplength=725,
              foreground="#704800").pack(anchor="w", pady=(10, 3))
    ttk.Label(top, textvariable=status, wraplength=725).pack(
        anchor="w", pady=(3, 7))

    def selected():
        return {key: var.get() for key, var in answers.items()}

    update_progress()

    def copy():
        try:
            value = summary_text(selected(), audio3_only=audio3_only)
            root.clipboard_clear()
            root.clipboard_append(value)
            root.update_idletasks()
            missing = [key for key in keys if selected()[key] == "pendiente"]
            if missing:
                status.set(f"Resumen PARCIAL copiado: {len(missing)} respuestas pendientes. "
                           "Puedes completar el Audio 3 y copiarlo otra vez.")
            else:
                status.set("Resumen completo copiado; pegalo en el chat cuando quieras.")
        except (ValueError, tk.TclError):
            messagebox.showerror("Error", "No se pudo copiar el resumen.")

    def save():
        import time
        # Name is generated only after operator explicitly clicks Save.
        target = out_dir / (
            "voice01j-public-review-" + time.strftime("%Y%m%d-%H%M%S") + ".json"
        )
        try:
            created = save_review(selected(), target)
            status.set("Revision guardada solo en carpeta local.")
            messagebox.showinfo(
                "Guardado local", "Revisiones (solo JSON, sin audio):\n" + str(created))
        except (ValueError, FileExistsError, OSError) as error:
            messagebox.showwarning("No se guardo", str(error))

    actions = ttk.Frame(top)
    actions.pack(fill="x")
    ttk.Button(actions, text="Copiar resumen para ChatGPT", command=copy).pack(
        side="left", padx=(0, 12))
    ttk.Button(actions, text="Guardar revision local (JSON)", command=save).pack(
        side="left")
    ttk.Label(top, text="El guardado es opcional. Nunca sube audios ni datos a GitHub.",
              wraplength=725).pack(anchor="w", pady=(8, 0))
    root.mainloop()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="VOICE-01J guided private human listening of public clips")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--consent", action="store_true")
    parser.add_argument("--audio3-only", action="store_true",
                        help="Mostrar solo Audio 3 y sus dos preguntas pendientes.")
    args = parser.parse_args(argv)
    if args.doctor:
        print(json.dumps({
            "lab": "VOICE-01J",
            "ok": True, "mode": "doctor_no_gui",
            "audio_files_written_by_default": 0,
            "microphone_enabled": False, "network_enabled": False,
            "user_save_required": True,
        }))
        return 0
    if not args.consent:
        print(json.dumps({"lab": "VOICE-01J", "ok": False,
                          "error_code": "CONSENT_REQUIRED"}), file=sys.stderr)
        return 1
    if sys.platform != "win32":
        print(json.dumps({"lab": "VOICE-01J", "ok": False,
                          "error_code": "WINDOWS_ONLY"}), file=sys.stderr)
        return 1
    private = Path(os.environ.get("LOCALAPPDATA", "")) / "ORBI" / "LUMIA-VOICE-LAB"
    if not os.environ.get("LOCALAPPDATA"):
        return 1
    try:
        pcm = checked_public_audio(private / "samples")
        launch_gui(pcm, private / "reviews", audio3_only=args.audio3_only)
        return 0
    except (OSError, ValueError, RuntimeError, ImportError) as error:
        print(json.dumps({"lab": "VOICE-01J", "ok": False,
                          "error_code": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
