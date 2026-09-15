# L.U.M.I.A. avatar asset

The first hologram prototype expects the avatar at:

```text
public/models/lumia/lumia.glb
```

The current source GLB is intentionally kept local during the visual prototype
instead of being committed as a normal Git blob. It is approximately 17 MB and
should be moved to Git LFS or another governed asset path once the avatar pass
is certified.

Source asset characteristics used by the prototype:

- glTF 2.0 binary (GLB)
- one scene / one mesh
- Y-up bounds approximately 0..1
- no embedded animation clips
- textured PBR material

`src/scene/LumiaAvatar.tsx` scales and centres the model automatically inside
the holographic reactor and adds only procedural idle motion.
