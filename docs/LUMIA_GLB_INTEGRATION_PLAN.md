# L.U.M.I.A. GLB Integration Plan

## Objective

Integrate the existing static L.U.M.I.A. GLB as the three-dimensional center of the current holographic reactor without requiring a rig or embedded animation.

## Principle

Do not replace the strongest visual parts of the current interface.

Keep:

- outer reactor glow;
- concentric orbital rings;
- particle field;
- HUD rails;
- audio visualisation;
- boot choreography;
- camera depth and post-processing.

Replace or subordinate only the current inner reactor core.

## Proposed scene structure

```text
Scene
  +-- Environment / camera
  +-- ParticleField
  +-- RearOrbits
  +-- LumiaCore
  |     +-- GLB model
  |     +-- procedural idle transform
  |     +-- state response
  +-- FrontOrbits
  +-- AudioAura
  +-- HUD
```

Suggested future files:

```text
src/scene/LumiaCore.tsx
src/scene/LumiaAura.tsx
src/scene/lumiaMotion.ts
```

## Procedural motion v1

No skeleton required.

### IDLE
- slow vertical sinusoidal float;
- very small yaw drift;
- low particle energy;
- slow orbital speed.

### WAKE
- short scale settle from approximately 0.97 to 1.00;
- brighter halo;
- rings align briefly.

### LISTENING
- slight forward tilt;
- microphone amplitude drives outer rings;
- particles remain controlled.

### THINKING
- avatar remains calm;
- orbit speed rises;
- secondary particles become more active;
- no fake mouth movement.

### ACTING
- stronger directional orbital motion;
- HUD tool indicator becomes visually dominant;
- avatar can rotate a few degrees toward the active panel.

### SPEAKING
- actual TTS output level drives ring amplitude and aura;
- subtle body-scale breathing pulse;
- lighting responds to speech envelope;
- no lip-sync required.

### SUCCESS
- short controlled pulse/effect;
- return to idle.

## Audio-reactive goal

The environment, not the mouth, communicates speech.

When L.U.M.I.A. speaks:

```text
TTS audio
   -> analyser
   -> level / future FFT bands
   -> ring displacement
   -> glow intensity
   -> particle response
```

The existing output-level path should be reused first. Frequency-band FFT mapping can be a later visual pass.

## GLB requirements for first integration

The current static GLB is sufficient if:

- geometry and materials load correctly;
- scale/origin can be normalized;
- model can be centered around the reactor;
- no unsupported external texture references are missing.

A rig, blendshapes and animation clips are explicitly not required for v1.

## Future animation pass

Only after the visual/reactive prototype is stable:

- optional humanoid/character rig;
- idle clip;
- listening acknowledgement;
- working pose;
- success acknowledgement;
- subtle head/upper-body tracking.

Avoid full lip-sync unless later testing proves it improves the experience. The design goal is a technological intelligent presence rather than a human talking-head avatar.

## First implementation milestone

A successful prototype means:

1. GLB renders at the reactor center.
2. Existing rings and particles remain intact.
3. Avatar is viewable in full 3D.
4. Idle float is smooth.
5. LISTENING and SPEAKING states visibly differ.
6. TTS output drives the surrounding aura.
7. Frame rate remains acceptable on the ORBI development laptop.
