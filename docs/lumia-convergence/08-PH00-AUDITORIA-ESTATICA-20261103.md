# PH-00 — Auditoría estática de convergencia Portal + Motion

**Fecha:** 2026-11-03. **Estado:** auditoría de fuentes completada; **pruebas de ejecución del portal y QA visual todavía pendientes**.

## Referencias congeladas
- Repositorio: `ingeniusvictor/orbi-jarvis-agent-lab`.
- Rama funcional **inspeccionada**, NO `main`: `feature/lumia-consolidated-release-20261028`.
- SHA funcional: `3e7daa9390a674ccabc5c9cbb5597c1d3b1b5533`.
- `main` al auditar: `1c4016afdf86f7043efc6882ceffef84ad0d8783`; la consolidada está **748 commits por delante, ninguno por detrás**. No tomar main como base técnica efectiva.
- La documentación continúa en `docs/lumia-portal-motion-convergence-20261101` y PR #34.
- Repositorio Motion confirmado: `ingeniusvictor/lumia-motion-lab`; PR #1 documentación, PR #2 fuentes R8.

## Inventario verificado por inspección del código
| Componente | Ruta actual | Implicación |
|---|---|---|
| Avatar GLB legacy y offsets | `src/scene/LumiaAvatar.tsx` | `useGLTF('/models/lumia/lumia.glb')`, perfil face-only y compensación óptica. Conservar como fallback. |
| Reactor y escena | `src/scene/Scene.tsx` | React Three Fiber: Core, Avatar, Orbits, Particles y postproceso Bloom. Añadir VRM como componente hermano y no duplicar Canvas. |
| Fases | `src/store.ts` | offline, boot, dormant, waking, listening, thinking, tooling, speaking. |
| Orquestación de turnos | `src/App.tsx` | Gestiona consulta, streaming, TTS, interrupciones, HUD y modo de voz. |
| TTS real | `src/lib/tts.ts` | `createSpeaker(onFirstAudioStart, onPhraseStart)`; callbacks de inicio verdaderos desde `SpeechSynthesisUtterance.onstart` y `audio.onplaying`. |
| Escucha/barge-in | `src/lib/voice.ts` | VAD/STT Whisper o browser, guard de eco e interrupciones. |
| Dependencias en baseline | `package.json` | React 19, three ^0.185.1, @react-three/fiber ^9.7.0, vite ^8.2.0, Node >=20. Compatibilidad de @pixiv/three-vrm **a verificar antes de importarlo**. |

## Hallazgo CRÍTICO sobre sincronización
En `src/App.tsx`, `onText` marca `phase='speaking'` al recibir el **primer texto generado**, **antes** del inicio audible de TTS. Lo mismo ocurre en ruta de respuesta no-streaming. Por tanto:

**NO usar `phase === 'speaking'` como única prueba de voz audible para boca/visemas.**

El punto correcto para iniciar la sesión visual es el callback `onFirstAudioStart` del `createSpeaker` ya existente, y `onPhraseStart` para la frase actual. La reproducción nativa usa `SpeechSynthesisUtterance.onstart`; TTS cloud/neural usa `HTMLAudioElement.onplaying`. Los eventos `speaker.end()` (fin de cola), `speaker.cancel()` y el corte por barge-in deben acabar/inutilizar sessionId correspondiente.

No hay aquí evidencia de que `createSpeaker` exponga hoy marcas precisas por palabra; si no las expone, usar interpolación aproximada **etiquetada**, no atribuir precisión inexistente. La fase 'speaking' sí puede continuar para HUD y reactor legacy.

## Arquitectura de primer experimento PH-01
1. Flag nuevo y reversible `VITE_LUMIA_AVATAR_MODE=legacy|head-vrm` (a implementar; hoy **NO existe**). Legacy predeterminado.
2. Mantener `LumiaAvatar.tsx` íntegro. Crear `LumiaPortalHead.tsx` o similar con `GLTFLoader` + `VRMLoaderPlugin` para VRM Motion canónico, reutilizando THREE del portal.
3. Ocultar visualmente el cuerpo sin modificar VRM, preservando Face/Hair, ojos, cuello, morph targets, expressions y esqueleto. Validar recorte del cuello.
4. No cargar FBX corporales en Portal Head. No copiar el `index.html` de Motion dentro del portal. No duplicar cerebro/STT/TTS.
5. Encajar cabeza grande en aro, respetar offsets CSS, controlar Bloom/luz para que ojos y boca sean legibles.
6. Un solo escritor por hueso/expresión por frame. Driver VRM facial de Motion con adaptador a las fases/eventos del Portal.
7. Si falla carga/head, fallback a GLB legacy y conversación funcional.

## Gate PH-00 (ANTES de escribir PH-01)
- Ejecutar en Windows/ASUS: `npm ci`, `npm run build` y los certificadores de VRM y voz ya existentes en `package.json` (revisar scripts de la rama efectiva).
- Guardar captura 16:9 de la UI original, prueba de arranque, prueba de texto, voz, interrupción y audio local.
- Comprobar puertos 5173 (Vite) / 8787 (bridge) y cualquier puerto ocupado por el visor Motion. No confundirlos.
- Guardar línea base de FPS, memoria GPU/CPU, primera respuesta y audio; no inventar tiempos.
- Verificar modelo actual `/models/lumia/lumia.glb` y VRM fuente *sin subir assets privados*.
- Definir PASS/FAIL, evidencia, responsable, fecha, SHA, hash y siguiente acción.

## Estado y siguiente acción
**PH-00 auditoría estática PASS**; **PH-00 pruebas locales de Portal PENDIENTES**; **PH-01 sin iniciar**. Implementar el flag reversible únicamente después de congelar la referencia funcional y completar los tests.
