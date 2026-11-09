# LUMIA VQ-02 — Comprensión de órdenes del propietario / ASUS QA real (2026-11-09)

**Estado al documentar:** correcciones del parser aplicadas a la rama experimental y pruebas de regresión automatizadas aprobadas en GitHub PH-01 para el commit de código **0aae4febfe94656faa3889f92715ccff2aeec397**. **Pendiente**: reproducir físicamente las órdenes en la ASUS actualizada. No afirmar que el usuario ya probó este parche.

**Repositorio:** `ingeniusvictor/orbi-jarvis-agent-lab`; **rama:** `feature/lumia-vi04c1-open-set-calibration-cpu-20261109`; **PR:** [#77](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/77), borrador acumulativo sobre PR #74–#76, no fusionado.

## 1. Evidencia REAL de la ASUS antes del parche

Fuente: dos exportaciones de diagnóstico de conversación facilitadas por el usuario el 9 de noviembre, ventana de conversación 19:26–19:32 hora del navegador. Los archivos completos de voz/transcripción permanecen en el chat del usuario; **no se guardaron en Git las fotografías, audios, identidades, rutas personales ni la transcripción completa**.

| STT de Whisper (frase real, abreviada) | Respuesta antes del parche | Clasificación |
| --- | --- | --- |
| «¿puedes verificar cuántos tipos de IA local tienes…?» | «No tengo acceso a herramientas de actualización ni verificación» | INCORRECTO: debía consultar inventario de Ollama, no ejecutar actualización |
| «cuantas IA locales disponibles tienes para cambiar» | Respuesta genérica de aclaración | INCORRECTO: debía devolver conteo real |
| «… quiero saber cuántas IA local tiene disponible» | Respuesta genérica de falta de acceso | INCORRECTO: debía devolver inventario local sin inventar modelos |
| «Lumi cambia a Qwen 4B» | Anunció `qwen3.5:4b-vision4096` | FUNCIONÓ: selección real notificada |
| «Lumia cambia a Qwen 2B» | «No encuentro un modelo instalado…», aunque listó `qwen3.5:2b-q4_K_M` | INCORRECTO: el extractor no aceptaba tamaño 2B |
| «Lumia cambia a Qwen 3.5, 2B» | Anunció `qwen3.5:2b-q4_K_M` | FUNCIONÓ: etiqueta explícita |
| «Lumiar cambia a la versión de medio cuerpo» | Buscó modelos instalados en Ollama | INCORRECTO: un comando de VISTA fue enrutado como MODELO |
| «… tres formas de visualizar… puedes corroborar eso» | Explicación abstracta, sin verificar el avatar real | INCORRECTO: el catálogo PH-04 ya ofrece 3 vistas |
| «Silumia, usa la vista de medio cuerpo» | Buscó modelos instalados en Ollama | INCORRECTO: STT deformó el nombre y el router admitió «usa la vista» como petición de modelo |

En la sesión, Ollama informó de **cuatro modelos instalados** (observación concreta, no estado permanente): `qwen3.5:4b-vision4096`, `qwen3.5:4b-fast`, `qwen3.8:4b-gpu` y `qwen3.5:2b-q4_K_M`. En una nueva sesión la respuesta debe obtenerse de Ollama en tiempo real, **sin usar una lista fija**. «Entrenamos cuatro tipos» fue una frase del usuario; **no prueba que todos fueron entrenados ni que estén cargados en RAM**.

## 2. Causa raíz contrastada en código

- `bridge/orbia/model-manager.mjs`: `requestedSize()` omitía `2b`. Así, «Qwen 2B» podía no resolver el nombre de modelo instalado aunque figurase en la lista. Añadidos también `0.8b` para el dispositivo alternativo y el mismo algoritmo de selección.
- `parseModelControl()`: aceptaba `cambia a ...` / `usa ...` indiscriminadamente, **sin indicio de dominio modelo**, robando comandos PH-04. Ahora exige pista explícita de modelo (Qwen/tamaño/modelo/cerebro/perfil), descarta peticiones del dominio visual/avatar y falla de modo seguro ante mezclas de dominios.
- La consulta de inventario solo entendía frases explícitas con `modelos`, no los términos españoles de voz «cuántas IA locales», «cuántos tipos de IA local». Se amplió el parser para contabilizar modelos **solo con contexto local/instalado/usuario**, no preguntas genéricas sobre cuántas IA existen en el mundo.
- `src/scene/lumia-motion-r8/avatar-presence-ph04.ts`: el nombre de activación original no reconocía «Lumiar» ni «Silumia», y la orden `usa` no era un verbo de vista. Se añadieron alias específicos STT, `usa/utiliza/elige` y una lectura de catálogo para preguntas sobre las **tres vistas existentes**, sin realizar un cambio no solicitado.
- El nuevo gate PH-01 obligó a corregir dos errores de parser **preexistentes** que habían escapado a CI: `cámbiate` con tilde y «¿puedes cambiar de modelo?» frente a «cambia de modelo al 7B». Se mantuvo la intención original de cada frase y no se descartaron los tests.

## 3. Cambios aplicados y protección de regresiones

- `bridge/orbia/model-manager.mjs`: conteo y lista de IA local, tamaños 2B/0.8B, separación de intención avatar/modelo, captura con tilde, sin cambios en la conexión a Ollama ni las funciones de `warmOllama`.
- `src/scene/lumia-motion-r8/avatar-presence-ph04.ts`: prefijos de voz observados en ASUS, órdenes directas para busto y lectura de catálogo de tres vistas. Se conserva lógica original del avatar y de Motion R8; sin cambios en renderizado, rigging o assets.
- `scripts/certify-amr-model-runtime.mjs`: pruebas automatizadas con la lista real observada de 4 tags, frases exactas de conteo, cambio 2B/4B, negación, preguntas genéricas y seguridad frente a comandos visuales.
- `scripts/certify-lumia-avatar-presence-ph04.ts`: transcripciones reales «Lumiar…» y «Silumia…», más consulta de tres vistas y **contrato cruzado**: el parser de Ollama no puede reclamar una orden del avatar.
- `.github/workflows/lumia-ph01-head-poc.yml`: el PR ejecuta ambos contratos nuevos, además de build, lint y regresiones RC-02/RC-03/PH-01. Esto evita que se declaren verdes con errores evidentes de enrutamiento.
- Verificación PH-01 posterior: https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/42714133229 **SUCCESS**, incluye `AMR-01 Adaptive Model Runtime smoke test: PASS` y `PH-04 PASS`. Build PASS, `oxlint`: 0 errores, 9 advertencias heredadas.
- Sin fotos, datos de voz, llaves, modelos nuevos ni nuevas capacidades de IA descargadas. No se cambia `main`, el lanzador ASUS ni el modelo 2B por defecto. No se habilita reconocimiento biométrico.

## 4. Un problema APARTE: Kokoro responde, pero las pausas largas siguen existiendo

La sesión contenía ejemplos de primer texto en **71–116 ms** para respuestas de inventario/controles y **84 ms** para el cambio a 2B. Eso demuestra enrutamiento rápido, **NO** fin rápido de audio. Hubo pausas atribuibles a Kokoro/WAV de **5.096 s, 6.174 s y 5.542 s** en mensajes largos, y **3.536 s** en otra respuesta. El cambio a 4B demoró **12.33 s** al primer texto y un segmento atribuyó **9.191 s** a esperar al modelo.

**No modificar ahora** el motor de audio ni forzar un 4B. Tras confirmar VQ-02 en la ASUS, medir primer texto, primer audio, pausas Kokoro/WAV, duración total, número de segmentos, CPU/RAM y posibles respuestas muy largas. El nuevo inventario `count` debe ser conciso y evitar leer cuatro tags cuando solo se preguntó cuántos hay. Para listas completas, pronunciación de nombres de modelo sigue siendo un problema menor de TTS.

## 5. Siguiente QA real en ASUS (pendiente)

1. Mantener el lanzador diario ASUS con Qwen3.5 2B, Whisper y Kokoro; detener solo LUMIA antes de actualizar la rama. `git status --short` debe estar limpio. Descargar por fast-forward; ejecutar `npm run lint` y, si es viable, `npm run build` y las dos pruebas nuevas.
2. **Sin webcam ni reconocimiento facial**, comprobar comandos de conteo: «Lumi, ¿cuántas IA locales tienes disponibles?» (debe informar el número real actual, sin invocar el modelo generativo para inventarlo); «¿qué modelos locales tienes?» (debe enumerar tags instalados desde Ollama).
3. Probar «Lumia cambia a Qwen 2B», incluso después de haber pasado a 4B; debe seleccionar el 2B exacto instalado, sin carga cloud ni inventar modelos. Volver a 2B al final.
4. Probar «Lumia, usa la vista de medio cuerpo», «Silumia, usa la vista de medio cuerpo» y «Lumiar cambia a la versión de medio cuerpo». Debe cambiar el avatar a `bust-vrm` **sin consultar Ollama para cambiar el cerebro**. «Lumia, ¿cuáles son tus tres vistas?» debe decir rostro/medio cuerpo/cuerpo completo **sin mover el avatar**.
5. Añadir comandos negativos: «No cambies de modelo», «Ayer vi a alguien cambiar de modelo», «Muéstrame cómo cambiar una vista en Blender»; **no** deben hacer cambios locales.
6. Confirmar visualmente la vista que aparece: la frase de respuesta sola no prueba renderizado real. Si una vista falla, identificar por separado si se trata de parser, store o asset/R8.
7. Hacer 3–5 turnos normales no relacionados y comprobar que LUMIA sigue respondiendo con Qwen 2B, con Whisper/Kokoro, sin caída de tiempo o audio.
8. Enviar solo resultados redactados o métricas, no grabaciones privadas; anotar PASS/FAIL por orden para cerrar la regresión física.

**Gate de liberación:** mantener #77 en borrador; CI verde no equivale a ASR o renderizado validados en el equipo. El siguiente hito debe llamarse **VQ-02 / QA físico ASUS**, no «reconocimiento facial completado».

## 6. Prompt para continuar en un chat nuevo

«Continúa LUMIA desde `docs/lumia-convergence/39-VISION04-CONTINUIDAD-20261109.md` y este `40-VQ02-COMPRENSION-COMANDOS-ASUS-20261109.md`. Revisa HEAD actual en PR #77. Se corrigió enrutamiento de inventario Ollama (IA locales, Qwen 2B) y PH-04 avatar (Lumiar/Silumia/medio cuerpo) con regresiones CI. Falta QA físico ASUS y analizar pausas Kokoro/WAV. No fusionar `main`, cambiar Qwen 2B/Whisper/Kokoro o activar registro facial sin permiso.»
