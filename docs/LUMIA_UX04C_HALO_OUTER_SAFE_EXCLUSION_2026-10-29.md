# UX-04C — Outer-halo safe text (owner screenshot regression)

**Reported**: on a real ASUS screenshot after UX-04B, a few response lines still entered the bright rings near the lower-right quadrant despite a visually curved rail. UX-04B's polygon was geometrically mirrored, but some block-level/time/decode rows were not consistently protected by CSS `shape-outside` because the float is per-turn and its height depends on rendered content.

**Fix**: (1) The ring safety radius now follows the shortest canvas dimension (0.355×) plus an explicit 36 CSS px protective outer band. (2) Keep native `shape-outside: polygon()` for smooth curves where Chrome applies it correctly. (3) On each measured layout/scroll event, query real browser text-line rectangles via `Range.getClientRects()`, compute their distance to the *external* protected circle including another 14px optical gap, and enable a conservative per-turn outward indentation if even one line intersects. Never clip text or mask the scene. The inset is limited to retain at least 190 CSS px for reading. The fallback affects only the particular turn; no ongoing background audio processing.

This feature remains reversible via `VITE_LUMIA_CURVED_TEXT=0` in the ASUS launcher (restart Vite to apply). Does not modify Qwen, STT, Kokoro, microphone settings, avatar meshes/camera/rings or the glass composer. Scroll remains functional, and small viewports retain UX-03.

**Validation**: deterministic tests include screenshot-like coordinates x943/y610, both lanes, multiple text lines, halo-free areas, radius and cleanup. Automated CI is not proof of the exact final Windows layout; review an ASUS screenshot with long translated answers and speech diagnostics before signoff.
