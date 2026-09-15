# O.R.B.I.A. + L.U.M.I.A. — Identity Foundation

## Product hierarchy

**O.R.B.I.A.** is the ORBI intelligent platform.

> **Operational Resources & Business Intelligence Assistant**

Spanish working definition:

> **Asistente de Recursos Operativos e Inteligencia Empresarial**

**L.U.M.I.A.** is the primary intelligent companion / persona exposed by O.R.B.I.A.

> **Largely Useful Multitasking Intelligent Assistant**

Spanish working definition:

> **Asistente Inteligente Multitarea Ampliamente Útil**

Everyday spoken name: **Lumi**.

## Design rule

O.R.B.I.A. is the system. L.U.M.I.A. is the presence.

The platform may later support additional companions, interfaces or specialist agents without changing the O.R.B.I.A. core.

## Intended stack

```text
ORBI Ecosystem
    |
    +-- O.R.B.I.A. Core
          |
          +-- Local AI Router
          |     +-- Qwen / Ollama
          |     +-- future local models
          |     +-- optional cloud providers
          |
          +-- Memory
          +-- Vision
          +-- Voice
          +-- Tools / MCP
          +-- Computer control
          +-- Edge Mesh
          |
          +-- L.U.M.I.A.
                +-- 3D GLB avatar
                +-- holographic scene
                +-- audio-reactive aura
                +-- companion personality
```

## Boot presentation concept

The first-run sequence should preserve the cinematic strengths of the current JARVIS interface while replacing its identity with ORBI.

Proposed sequence:

```text
O.R.B.I.A. SYSTEM
INITIALIZING...

LOCAL AI .......... ONLINE
VOICE ............. ONLINE
VISION ............ ONLINE
MEMORY ............ ONLINE
TOOLS ............. STANDBY
EDGE MESH ......... STANDBY

INITIALIZING INTELLIGENT COMPANION...

L.U.M.I.A.
Largely Useful Multitasking Intelligent Assistant

SYSTEM READY
```

When the visual sequence finishes and the L.U.M.I.A. GLB is present in the reactor core, the first spoken line is:

> Hola. Soy L.U.M.I.A. Puedes llamarme Lumi. Estoy lista.

On later normal boots, use a shorter acknowledgement such as:

> Lumi en línea.

The first-run presentation should be stored as a local preference so it is not repeated every launch.

## Visual direction

The existing holographic reactor is not discarded. The L.U.M.I.A. GLB becomes the core while the current rings, particles, glow and HUD become her expressive aura.

Initial GLB has no embedded animation. First integration therefore uses procedural motion:

- gentle vertical idle float;
- subtle yaw rotation;
- small state-driven tilt;
- state-driven light intensity;
- orbit speed changes;
- particle activity changes;
- audio-reactive ring amplitude.

Target states:

`IDLE -> WAKE -> LISTENING -> THINKING -> ACTING -> SPEAKING -> SUCCESS`

No lip-sync is required for the first version. The holographic environment itself is the primary speech expression.

## Wake word

The long-term wake word is **Lumi**.

During the laboratory phase, `Jarvis` may remain available for compatibility until voice routing and local STT are stable.

## Naming note

An internal easter-egg expansion may exist for O.R.B.I.A.:

> Only a Rather Basic Intelligent Assistant

This is not the commercial / official expansion.

## Integration rule

The current `orbi-jarvis-agent-lab` remains the research laboratory.

Do not migrate a capability into the canonical L.U.M.I.A. product until that capability has passed functional and safety validation in the lab.
