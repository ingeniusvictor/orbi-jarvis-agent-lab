# L.U.M.I.A. Companion Visual V1 — Freeze

## Status

**VISUAL ACCEPTANCE: CLOSED**

The current L.U.M.I.A. holographic companion presentation is accepted as the
Visual V1 baseline for the convergence branch.

This freeze records a visual/product decision only. It does **not** claim a new
lint/build/runtime certification beyond what has already been manually tested.

## Accepted baseline

- ORBI-native startup / ignition sequence.
- O.R.B.I.A. + L.U.M.I.A. visible identity.
- L.U.M.I.A. GLB integrated inside the holographic reactor.
- Final vertical optical correction retained.
- Horizontal camera drift removed to avoid parallax against the reactor.
- Final horizontal correction expressed in screen pixels rather than world
  units.
- Current optical horizontal correction:
  - `OPTICAL_SHIFT_PX = -28`
- Current vertical optical lift:
  - `OPTICAL_LIFT = 0.095`
- Avatar remains frontal on first presentation and uses only subtle procedural
  motion afterward.
- Reactor, particles, HUD and L.U.M.I.A. remain visually integrated.

## Acceptance note

The final position is considered sufficiently centred for V1. A very small
residual optical offset may remain, but it is not visually significant enough
to justify further tuning at this stage.

Do not continue micro-adjusting avatar centring unless a future layout/camera
change makes the offset materially visible again.

## Next phase

Proceed with the convergence roadmap:

**C1 — Canonical Contract Mapping**

Map the current holographic bridge/provider contracts against the legacy LUMI
capabilities in `ingeniusvictor/orbi-chatbox-ia-core`, prioritising:

1. identity/personality;
2. Knowledge Engine;
3. conversation/memory contracts;
4. local voice stack;
5. Tool Engine / permission boundary.

The JARVIS Lab repository remains a permanent experimental lab and is not to be
discarded.
