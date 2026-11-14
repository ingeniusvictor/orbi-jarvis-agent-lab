# VQ-04 — Rostro natural en el avatar VRM real (14-11-2026)

## Decisión de producto: salir del bucle de benchmarks

El propietario indicó: «tenemos que continuar con las mejoras creo que estamos redundando mucho sobre este tema». Se congela el análisis VA-02/VA-02.4 de Kokoro salvo regresión nueva. El estado evidenciado: Whisper local, Qwen 3.5 2B, Kokoro residente y las tres vistas VRM están funcionando; ONNX concentra ~98–99% de tiempo TTS. El A/B de hilos no mostró mejora convincente y el ensayo VA-02.3 fue invalidado por deriva temporal de +101.7%; HWiNFO no registró overheating durante su captura breve. **Mantener CPU auto, sin ajustes de energía, hilos, CUDA o voces.**

### Qué ya existía

- El adaptador `portal-body-companion.ts` **ya** convierte `phase` + audio audible en `idle/listening/thinking/speaking`, con BodyMotionCore, BodyPresenceCore, MotionIntelligence R8 y un motor de gestos semánticos al hablar.
- El visor `LumiaPortalHead.tsx` **ya** controla la mirada según puntero/estado y mueve boca con un cálculo de visemas a partir del texto audible. No es lip sync basado en audio real.
- El parpadeo del rostro se calculaba con `Math.exp(-((t%3.73-3.57)/.046)^2)`: repite exactamente la misma cadencia cada ~3.73 s. El rostro puede parecer artificial incluso cuando el cuerpo ya tiene varios estados.
- No habría valor en duplicar controlador de fases ni el prefetch TTS ya habilitado.

### Nueva capacidad visual real, opt-in VQ-04

Archivos: `src/scene/lumia-head/natural-face-vq04.ts` y `LumiaPortalHead.tsx`.

- `NaturalFaceMotionVQ04` calcula ritmos **no periódicos** de parpadeo (intervalos discretamente variables, cierre/apertura suaves y un doble parpadeo ocasional) y pequeños cambios de fijación de la mirada. Usa generador determinista local, no jitter aleatorio por frame ni telemetría.
- Se integra directamente en la malla original Vita VRM con el morph `blink` ya existente y los huesos oculares actuales. Máximos seguros: **±0.024 rad de guiñada**, **±0.014 rad de inclinación** adicional; suavizado continuo. En escucha mantiene una mirada más estable, en pensamiento permite desviar discretamente la vista, y durante habla gestos oculares sutiles.
- La boca, visemas Kokoro, giros de cabeza, prioridad de FBX explícitos y control Motion R8 **no cambian**.
- `VITE_LUMIA_NATURAL_FACE_VQ04=1` únicamente en `INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd`; variable ausente en el lanzador diario, comportamiento anterior sigue disponible sin activar flag. No micrófono/cámara/face ID/red/archivos persistentes.
- QA una sola vez por sesión: `[lumia:vq03-avatar] {"event":"natural-face-observed",...}` con número de parpadeo y yaw cuando el blink llegó a >65%. No son imágenes ni transcripciones; ese evento acredita cómputo aplicado a la representación, **no** sustituye la observación ocular del dueño sobre aspecto natural.
- `scripts/certify-lumia-vq04-natural-face.ts` prueba 90 segundos simulados a 60 FPS: amplitudes, no periodicidad, parpadeo doble eventual, suavidad, determinismo y regresión visemas/R8. CI Windows y Ubuntu no usa activos privados y no acredita QA visual con personaje original.

### Prueba física ASUS

Después de CI Windows/Ubuntu PASS y solo en clon `LUMIA-VQ03-QA`:
1. Cerrar instancia anterior `Ctrl+C`, verificar original protegido SHA `1580a5182eba540893e35e37065be77da4ed014c`, rama VQ-03, Git limpio.
2. Actualizar **solo clon** con `git fetch` y `git merge --ff-only FETCH_HEAD`, confirmar SHA aprobado. El lanzador `node scripts/lumia-vq03-local-voice-qa.mjs` mantiene voz Whisper+Kokoro de origen en lectura.
3. Chrome `http://localhost:5173`, INITIALISE, vista `solo rostro`. Observar 30–60 s de parpadeos, su ritmo variable y el pequeño movimiento de mirada sin desviaciones bruscas. Mirar Console F12 filtro `lumia:vq03-avatar` y comprobar `natural-face-observed`.
4. Activar `medio cuerpo` y `cuerpo completo` y dar órdenes de saludo/gesto explícito. Deben respetar el gesto FBX completo sin interferencia facial; probar `Lumi, hola` para comprobar visemas durante audio.
5. Escuchar si la voz sigue igual, y evaluar si la cara parece más viva o excesivamente inquieta; si resulta peor, rollback desactivando el flag SOLO en el lanzador QA o volviendo al baseline del clon. Nunca cambiar `LUMIA-ASUS` directamente.

### Puerta de promoción

Pruebas sintéticas PASS + demo visual real sin deformaciones + 3 vistas/gestos R8 intactos + visemas/audio sin interrupción + rollback demostrado. No fusionar PR #83 ni promover a la instalación principal solo por CI.
