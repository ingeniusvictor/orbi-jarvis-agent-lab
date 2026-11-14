# LUMIA VQ-03 — VRM no es VRAM; preguntas técnicas no son comandos del avatar

**Corte:** 13-11-2026; **estado:** corrección aislada de código en PR draft, no instalada en ASUS ni integrada a LUMIA MASTER.
**Base protegida:** rama `feature/lumia-vi04c1-open-set-calibration-cpu-20261109`, SHA `1580a5182eba540893e35e37065be77da4ed014c`. Backup LM-01 físico PASS (19 assets, 18 obligatorios, Git bundle SHA-256 OK). **No hacer reset/checkout/merge ni reemplazar el launcher diario en la ASUS.**

## 1. Evidencia física del usuario — diagnosticada, no inventada

| Turno observado (13-11-2026, conversación local ASUS) | Respuesta y temporización | Diagnóstico |
| --- | --- | --- |
| «Hola Lumi, ¿cómo estás?» | primer texto **2.52 s**, primer audio **2.98 s**, 3 fragmentos, pausa previa audio #2 **698 ms** (Kokoro/WAV **685 ms**), fin total **8.74 s** | Conversación básica y TTS funcionaron; no prueba animaciones |
| «¿qué sabes tú acerca de los VRAM y cómo podemos hacer para que un VRM tenga animaciones fluidas?» | respuesta preprogramada enumera **17 animaciones**; primer texto **2 ms**, primer audio **2.46 s**, final total **34.96 s** | **BUG de enrutamiento**: parser `avatar-presence-ph04.ts` coincidía por `sabes` + `animaciones` aunque se pedía una explicación técnica |
| «si quisiera hacer de una IA local un sistema nervioso que controlara la animación de un VRAM» | primer texto **4.42 s**, primer audio **6.46 s**, pausa antes del audio #2 **3.146 s** (Kokoro/WAV **3.114 s**) y fin **24.51 s** | Whisper produjo «VRAM», respondió sobre memoria GPU; STT ambiguo + modelo no aclarado. **Pausa TTS demostrada** |
| Reformulación por texto «una ia local un sistema nervioso ... animacion de un vrm» | primer texto **2.84 s**, primer audio **5.10 s**, fin **29.91 s**, volvió a decir «VRAM» y gestión de memoria | El texto **ya contenía VRM**. No es solo error de Whisper; Qwen no mantuvo la terminología sin anclaje explícito |

**No atribuir los 2 ms a inferencia de Qwen**: el texto de la lista salió del atajo local `respondToLumiaAvatarAction({kind:'list-motions'})`. Su latencia de primera palabra no es comparable a una respuesta generativa. **No atribuir los 34.96 s a una pausa técnica única**: buena parte corresponde a locución de una lista demasiado larga.

## 2. Corrección mínima VQ-03

- **Parser PH-04**: las preguntas de catálogo deben pedir **tus animaciones/movimientos/gestos** o indicar directamente «qué animaciones tienes». `sabes` y `animaciones` en una misma frase técnica ya no secuestran la consulta. Preguntas sobre **cómo se construye/controla la animación** pasan a Qwen.
- **Anclaje técnico VQ-03.1:** se trasladó desde la consulta del usuario a la instrucción SYSTEM de Ollama en `bridge/orbia/vrm-tech-grounding-vq03.mjs`; se activa solo con `ORBIA_LUMIA_VRM_GROUNDING_VQ03=1` en el lanzador experimental. No modifica la transcripción ni el historial de conversación, ni llega como contenido de usuario al clasificador SKILL-01. VRM designa un avatar humanoide; VRAM es memoria gráfica. Qwen puede explicar el controlador de estados, Motion R8, IK y visemas.
- El texto original de Whisper **no se altera** en la transcripción presentada, ni se reescribe el historial visible. Nunca cambiar **VRAM** si el usuario pregunta explícitamente por memoria gráfica/GPU.
- Ninguna nueva herramienta o permiso: no abrir webcam, micrófono, modelos, archivos, escritorio ni red por este contexto; **2B sigue siendo el cerebro predeterminado**.
- No tocar código de generación Kokoro/WAV por este PR: la pausa de 3.114 s merece **experimento A/B separado** y un presupuesto de latencia, no confundirla con el bug de comprensión.

## 3. Pruebas

`scripts/certify-lumia-vq03-vrm-clarity.ts`: las tres frases VRM/VRAM del propietario NO producen `list-motions` ni cambios Ollama, sí reciben hint breve si pasan al modelo. Mantiene comandos de vista/saludo y preguntas sobre el catálogo, excluye preguntas VRAM/GPU puras. Ejecutar regresiones existentes `certify-lumia-avatar-presence-ph04.ts`, `certify-lumia-avatar-ph042.ts`, `certify-amr-model-runtime.mjs`, `npm run lint`, `npm run build` en Windows/Linux.

## 2A. QA física por texto, 13-11-2026, 23:56–23:58 — regresión descubierta

En el clon VQ-03, el propietario pegó cinco preguntas escritas (STT vacío). El primer texto fue extremadamente rápido, pero **dos respuestas eran falsas derivaciones a atajos**:

| Texto de prueba | Primer texto | Primer audio | Observación |
| --- | ---: | ---: | --- |
| «¿Cómo puedo conseguir que un avatar VRM tenga animaciones fluidas?» | 2 ms | 106 ms | FALLO: PH-04 contestó con la descripción de su propia presencia virtual; regla demasiado amplia por la palabra «avatar» y «cómo». |
| «Si quisiera convertir una IA local en el sistema nervioso que controla un VRM, ¿qué tendría que hacer?» | 24 ms | 120 ms | FALLO: registro SKILL-01 devolvió el texto de MEM-01. La inyección anterior de contexto añadía «memoria», y la frase tenía «qué», lo que activó el atajo. |
| «¿Cuánta VRAM dedicada necesita una GPU para trabajar con animaciones?» | 5,31 s | 5,42 s | Qwen sí respondió sobre VRAM hardware. La cifra genérica indicada no está validada como compra. |
| «Lumi, salúdame con la mano» | 2 ms | 481 ms | Orden rápida detectada, pero el texto no certifica que el FBX se movió visualmente. |
| «Lumi, cambia a la vista de medio cuerpo» | 2 ms | 113 ms | Orden rápida detectada, pero el texto no certifica renderizado correcto. |

**Conclusión:** 2/24 ms para primer texto son respuestas locales predeterminadas, no benchmark de inferencia Qwen. 106/120 ms para primer audio no demuestran que el clon tenga el mismo runtime Whisper/Kokoro que ASUS original.

**VQ-03.1** corrigió ambas colisiones: regla PH-04 de descripción limitada al *propio avatar*; instrucción técnica en SYSTEM de Ollama, y pregunta original sin alteración en registro SKILL-01, RC-03 ni historial. Se añadieron las frases exactas a regresión. La corrección todavía necesita CI nuevo y QA física antes de promoverse.

**Limitación crucial:** esas pruebas certifican **enrutamiento/prompt** y compatibilidad de código, **NO** garantizan que Qwen 2B vaya a responder correctamente en vivo ni que mejoren automáticamente las pausas de audio. No promover a MASTER sin QA física.

## 4. QA física ASUS opcional después de CI

1. Mantener original en `LUMIA-ASUS`, cerrar su ventana antes de abrir un QA *aislado* si se decide probar VQ-03. No hacer `git checkout` en la carpeta principal ni copiar nuevos modelos. Un QA worktree necesita los recursos privados PH-04/R8 (consulta LM-01), por lo que **no arrancarlo** hasta preparar activos con preflight.
2. Asegurar avatar VRM/R8 moderno y Qwen `qwen3.5:2b-q4_K_M` sin cambio de ajustes.
3. Probar los dos enunciados VRM/VRAM reales: la respuesta esperada debe hablar **del avatar VRM**, no de memoria VRAM. No aceptar un simple listado de 17 animaciones.
4. Hacer una pregunta genuina sobre hardware: «¿Cuánta VRAM requiere una GPU para animación?»; debe hablar de memoria gráfica, sin corregirlo a avatar VRM.
5. Probar comandos directos «Lumia, salúdame» y «cambia a medio cuerpo»: deben ejecutarse sin pedir asesoría técnica a Qwen. Probar «¿cuáles son tus animaciones disponibles?» para conservar el catálogo instantáneo.
6. Comparar primer texto, primer audio y pausas entre fragmentos; una pausa de Kokoro de varios segundos se registra como asunto distinto.
7. Registrar PASS/FAIL con solo métricas anonimizadas; no compartir audios privados ni reposicionar el modelo por un test fallido.

**Gate de promoción:** solo al pasar CI Windows/Linux y QA ASUS, y demostrar la recuperación del avatar y voz en el mismo runtime. No agregarlo aún a LUMIA MASTER ni llamar al asistente «versión nueva estable».
