# VQ-05.1 — Expresiones faciales que sí se distingan

**Fecha:** 14-11-2026. Estado: laboratorio aislado `LUMIA-VQ03-QA`. PR #83 no fusionado; instalación original `LUMIA-ASUS` protegida en `1580a5182eba540893e35e37065be77da4ed014c`.

## Problema observado realmente por el propietario

Tras aprobar el parpadeo y la mirada VQ-04, el propietario observó sobre VQ-05: **«la fluidez la veo mejor pero expresiones diferentes a lo que ya teníamos, no logro distinguirlas bien cuando le pregunto lo que me dijiste»**. Por tanto, VQ-05 quedó **sin aprobar visualmente**.

Revisión del código encontró dos razones concretas:
- La demostración guiada anterior utilizaba **0,78** de intensidad del morph facial, mientras la nueva VQ-05 restringía alegría/tristeza/diversión a **0,28 / 0,20 / 0,24**. La diferencia puede ser muy difícil de distinguir en pantalla.
- VQ-05 solo reaccionaba a **frases precisas que LUMIA realmente pronunciara**; si Qwen respondía con otras palabras o partía la frase en dos fragmentos, el disparador podía no producirse. No era posible solicitar una expresión concreta a voluntad.

## Corrección VQ-05.1

1. **Conversación cotidiana:** pesos de la reacción a sus propias frases aumentados a `joy .48`, `sorrow .48`, `fun .50`, con suavizado, límites y regreso a neutro. No implica detección de emociones del usuario, ni alteración de voz/modelo ni síntesis nueva.
2. **Control facial directo por orden explícita del dueño:** `parseLumiaFaceActionVQ051` funciona solo bajo `VITE_LUMIA_FACE_DIRECT_VQ051=1` del launcher experimental. Requiere verbos de acción + contexto `cara/rostro/expresión facial` + destino exactamente identificado. Por ejemplo:
   - «Lumi, muéstrame tu expresión facial de alegría».
   - «Lumi, muéstrame tu expresión de tristeza».
   - «Lumi, pon cara de sorpresa» (usa preset VRM0 **`fun`**, que representa diversión y puede no equivaler a sorpresa auténtica).
   - «Lumi, muéstrame tu expresión de enojo».
   - «Lumi, pon cara neutral».
3. Esas peticiones no pasan por la interpretación generativa de Qwen; se resuelven localmente como acciones autorizadas del avatar, cambian automáticamente a la vista **solo rostro** y usan los **morphs reales** de Vita con intensidad objetivo **0,80**, suaves y visibles durante ~7,8 segundos antes de regresar a neutral. Nunca inventan morphs. Mensaje TTS sigue usando Kokoro original.
4. `FacePreviewVQ051` controla el sostén y las transiciones por frame, sin temporizadores globales, hilos, más audio, ni cambios de rig. Al activar la demo guiada original, se cancela el preview para respetar su prioridad.
5. Sin confundir control facial con clips FBX de Motion R8: «Lumi, ejecuta animación happy» sigue siendo un movimiento corporal; preguntas como «¿cómo se crean expresiones de tristeza?» nunca modifican la cara.
6. Si existe un preset en el VRM0, el auditor del clon informa `face-preview-observed` **solo después de que el peso aplicado supere 0,55**; si el preset falta, informa `face-preview-unavailable`. Ninguno de esos logs demuestra por sí solo una expresión bonita en pantalla, pero distinguen orden de control y blendshape real.

## Prueba física en ASUS

Después de CI Windows/Ubuntu PASS y de actualizar solo `LUMIA-VQ03-QA` por fast-forward (nunca reset/clean el original), arrancar `node scripts/lumia-vq03-local-voice-qa.mjs`, abrir `http://localhost:5173/`, INITIALISE y decir los cinco comandos anteriores en vista rostro.

**Aprobar únicamente si se aprecia:**
- alegría (sonrisa) claramente distinta de tristeza;
- tristeza claramente distinta de enojo;
- sorpresa/diversión no confundida con alegría si el asset lo permite (si se parecen, anotarlo como limitación del preset `fun`, no mentir sobre reconocimiento);
- boca/visemas y parpadeo VQ-04 siguen activos y fluidos;
- `neutral` devuelve el rostro natural y las expresiones no se congelan;
- órdenes de gestos corporales R8 y vistas permanecen independientes.

No hace falta repetir pruebas VA-02 de Kokoro: el usuario pidió pasar a mejoras visibles, no diagnósticos redundantes. Si al propietario no le convence la exageración facial, quitar solo `VITE_LUMIA_FACE_DIRECT_VQ051=1` y `VITE_LUMIA_SPEECH_EXPRESSIONS_VQ05=1` del launcher QA. Nunca alterar archivos de Vita ni fusionar PR #83 únicamente por CI.
