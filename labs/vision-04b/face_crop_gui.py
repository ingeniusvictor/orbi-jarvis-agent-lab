"""Optional VI-04B face crop chooser: human-selected ROI, memory-only.

Deliberately separate from camera capture, LUMIA's app runtime and enrollment.
It NEVER saves an image/crop, detects a face itself, chooses a face automatically,
or removes DeepFace's enforce_detection=True requirement.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

PREVIEW_MAX_WIDTH = 880
PREVIEW_MAX_HEIGHT = 650
MAX_DECODED_PIXELS = 32_000_000
MIN_CROP_SIDE = 80


class CropError(Exception):
    """Safe structured code; never forward the original image path or exception."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def selection_to_bounds(
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    preview_size: tuple[int, int],
    original_size: tuple[int, int],
) -> tuple[int, int, int, int]:
    """Convert user-drawn preview rectangle to pixel bounds; pure, testable."""
    pw, ph = preview_size
    ow, oh = original_size
    if min(pw, ph, ow, oh) <= 0:
        raise CropError("CROP_INVALID")
    coords = (*start, *end)
    if any(not math.isfinite(float(v)) for v in coords):
        raise CropError("CROP_INVALID")
    x0, x1 = sorted((start[0], end[0]))
    y0, y1 = sorted((start[1], end[1]))
    x0 = max(0., min(float(pw), x0))
    x1 = max(0., min(float(pw), x1))
    y0 = max(0., min(float(ph), y0))
    y1 = max(0., min(float(ph), y1))
    left = max(0, min(ow, int(x0 * ow / pw)))
    right = max(0, min(ow, int(math.ceil(x1 * ow / pw))))
    top = max(0, min(oh, int(y0 * oh / ph)))
    bottom = max(0, min(oh, int(math.ceil(y1 * oh / ph))))
    if right - left < MIN_CROP_SIDE or bottom - top < MIN_CROP_SIDE:
        raise CropError("CROP_TOO_SMALL")
    return left, top, right, bottom


def choose_face_crop(photo_path: str, photo_slot: str) -> Any:
    """Show original photo locally with Tk, return BGR numpy crop in RAM.

    Photo dialog requires an explicit drawn rectangular selection AND a click
    on the confirmation button. Closing the window aborts. Tk, OpenCV and
    NumPy are lazily imported (headless CI does not launch any UI).
    """
    try:
        import tkinter as tk
        import cv2
        import numpy as np
    except Exception:
        raise CropError("GUI_UNAVAILABLE") from None

    try:
        # cv2.imread() on Windows can fail with unicode path characters.
        raw = np.fromfile(str(Path(photo_path)), dtype=np.uint8)
        img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    except Exception:
        raise CropError("PHOTO_READ_ERROR") from None
    if img is None or getattr(img, "ndim", None) != 3 or img.shape[2] != 3:
        raise CropError("PHOTO_READ_ERROR")
    height, width = int(img.shape[0]), int(img.shape[1])
    if min(height, width) <= 0 or width * height > MAX_DECODED_PIXELS:
        raise CropError("PHOTO_TOO_LARGE")

    scale = min(1., PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height)
    preview_w = max(1, round(width * scale))
    preview_h = max(1, round(height * scale))
    preview = cv2.resize(img, (preview_w, preview_h), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(preview, cv2.COLOR_BGR2RGB)
    ppm_bytes = f"P6\n{preview_w} {preview_h}\n255\n".encode("ascii") + rgb.tobytes()

    try:
        root = tk.Tk()
    except Exception:
        raise CropError("GUI_UNAVAILABLE") from None
    result: dict[str, tuple[int, int, int, int] | None] = {"bounds": None}
    anchor: list[tuple[float, float] | None] = [None]
    last: list[tuple[float, float] | None] = [None]
    rect_id: list[int | None] = [None]
    try:
        root.title(f"LUMIA · Foto {photo_slot} · Seleccionar rostro (solo memoria)")
        root.resizable(False, False)
        tk.Label(
            root, text=(
                f"FOTO {photo_slot}: arrastra un rectángulo alrededor de UN SOLO rostro.\n"
                "Incluye frente, ojos, nariz y mentón. No incluyas otras caras.\n"
                "Esta selección no guarda imágenes. Cerrar = cancelar."
            ),
            justify="center", padx=12, pady=8,
        ).pack()
        frame = tk.Frame(root)
        frame.pack()
        canvas = tk.Canvas(frame, width=preview_w, height=preview_h,
                           highlightthickness=0, cursor="crosshair")
        canvas.pack()
        display = tk.PhotoImage(data=ppm_bytes, format="PPM")
        canvas.create_image(0, 0, anchor="nw", image=display)
        canvas._photo_ref = display  # retain Tk photo until window closes
        hint = tk.StringVar(root, "Selecciona un rostro con el mouse.")
        tk.Label(root, textvariable=hint, pady=5).pack()

        def on_down(ev: Any) -> None:
            anchor[0] = (float(ev.x), float(ev.y))
            last[0] = None
            if rect_id[0] is not None:
                canvas.delete(rect_id[0])
            rect_id[0] = canvas.create_rectangle(
                ev.x, ev.y, ev.x, ev.y, outline="#17e8bf", width=3
            )

        def on_move(ev: Any) -> None:
            if anchor[0] is not None and rect_id[0] is not None:
                canvas.coords(rect_id[0], anchor[0][0], anchor[0][1], ev.x, ev.y)

        def on_up(ev: Any) -> None:
            if anchor[0] is not None:
                last[0] = (float(ev.x), float(ev.y))
                on_move(ev)
                hint.set("Revisa el recuadro y pulsa «Usar recorte».")

        def on_confirm() -> None:
            if anchor[0] is None or last[0] is None:
                hint.set("Primero marca el recuadro con el mouse.")
                return
            try:
                bounds = selection_to_bounds(
                    anchor[0], last[0], preview_size=(preview_w, preview_h),
                    original_size=(width, height),
                )
            except CropError:
                hint.set("Recuadro demasiado pequeño. Incluye todo el rostro.")
                return
            result["bounds"] = bounds
            root.quit()

        def on_cancel() -> None:
            result["bounds"] = None
            root.quit()

        canvas.bind("<ButtonPress-1>", on_down)
        canvas.bind("<B1-Motion>", on_move)
        canvas.bind("<ButtonRelease-1>", on_up)
        buttons = tk.Frame(root)
        buttons.pack(pady=8)
        tk.Button(buttons, text="Usar recorte", command=on_confirm, padx=12).pack(
            side="left", padx=8
        )
        tk.Button(buttons, text="Cancelar", command=on_cancel, padx=12).pack(
            side="left", padx=8
        )
        root.protocol("WM_DELETE_WINDOW", on_cancel)
        root.mainloop()
    finally:
        root.destroy()

    bounds = result["bounds"]
    if bounds is None:
        raise CropError("CROP_CANCELLED")
    left, top, right, bottom = bounds
    # numpy crop stays in memory; no temp file, stdout, cache or photo database.
    return img[top:bottom, left:right].copy()
