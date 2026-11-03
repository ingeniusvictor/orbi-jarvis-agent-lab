# LUMIA PH-02 — Eye direction, head movement, illumination and portrait framing

## Source and boundaries
- Base: certified integrated RC-03 + RC-04 + SKILL-01 + PH-01 from PR #39, commit 6272fd18bf.
- Physical observation, 3 Nov 2026: head VRM loads; eye gaze follows cursor with horizontal polarity reversed; eye vertical is correct; head movement is not perceptible; Kokoro-to-viseme speech sync is good.
- No changes to VRM binary, bone hierarchy, audio events, conversation bridge, Whisper, Kokoro, Ollama, SKILL-01, translation, or model permissions.

## PH-02 changes
- Eye yaw horizontal sign corrected for the 180-degree facing transformation; vertical sign untouched.
- Whole visible head/hair rotates on a face-centred presentation pivot, smoothly following the cursor and subtly idling even if VRM head/neck bone resolution differs.
- Portrait fraction increased 0.54 -> 0.70 (+29.6% model scale) with subtle optical lowering.
- Only the head mode has softened ambient/key/cyan lights and cloned, softened face/hair materials. Legacy GLB remains unchanged.
- The original PH-01 TTS event start/phrase/end contract and approximate vowel visemes are unchanged.
- Optional authentic neck preview using the original Body mesh with clipping; this is OFF until the owner tests it because geometry/lighting cannot be certified without the private local VRM.

## Browser QA (reversible, no model changes)
- Normal PH-02 head: http://localhost:5173/?lumiaAvatar=head-vrm
- Compare to original PH-01 optics: http://localhost:5173/?lumiaAvatar=head-vrm&lumiaHeadQA=baseline
- Preview the real neck mesh: http://localhost:5173/?lumiaAvatar=head-vrm&lumiaNeck=1
- Legacy GLB backup: http://localhost:5173/?lumiaAvatar=legacy

Confirm pupil moves left with cursor left, right with cursor right, vertical unchanged, visibly smooth head rotation both directions, natural blink and lip sync, head fits ring and face features are visible without clipped whites. If neck preview shows shoulders, artifacts, or clipping, simply remove lumiaNeck=1. VRM source is never changed.

## Acceptance gates
- CI full existing regression, PH-01 and PH-02 static + pure motion tests, TypeScript build and ESLint.
- Human ASUS QA required for real visual direction, MToon/glTF material appearance and neck slice.
- Keep PR draft; do not merge main or declare 3D visual certification before physical acceptance.
