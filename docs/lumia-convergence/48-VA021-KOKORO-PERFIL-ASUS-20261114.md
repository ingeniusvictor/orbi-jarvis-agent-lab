# VA-02.1 — Descomposición de tiempo Kokoro sin optimización (14-11-2026)

**Estado:** instrumento de medición añadido a PR #83, solo para laboratorio aislado `LUMIA-VQ03-QA`, sin cambios sobre la instalación diaria `LUMIA-ASUS`. El modelo Qwen 3.5 2B, Whisper, archivos VRM/17 Motion R8 y pesos Kokoro se conservan. El PR sigue draft.

## Línea base física VA-02 reportada por el propietario

En la ASUS, con Kokoro **residente precalentado** y cuatro frases fijas en español repetidas en dos rondas, sin audio reproducido ni micrófono:

| Frase | Ronda 1 | Ronda 2 |
| --- | ---: | ---: |
| 1 | 1221.9 ms | 1180.3 ms |
| 2 | 1301.1 ms | 1104.0 ms |
| 3 | 1098.8 ms | 1530.5 ms |
| 4 | 1253.1 ms | 1599.7 ms |

**VA-02 baseline:** p50 **1221.9 ms**, p95 **1599.7 ms**, máximo **1599.7 ms**. 8/8 fragmentos OK, sin fallback. La segunda ronda no mejora de forma consistente. Estos tiempos incluyen la llamada TTS, transferencia y lectura/eliminación temporal del WAV; no corresponden a Chrome ni al tiempo desde final de STT hasta primer audio de conversación.

**Hallazgo de código importante:** la LUMIA diaria YA activa `VITE_LUMIA_TTS_PREFETCH_NEXT=1` y `VITE_LUMIA_FAST_FIRST_CHUNK=1` en `INICIAR_LUMIA_ASUS_RAPIDA.cmd`. En `src/lib/tts.ts`, `prime(queue[0])` inicia una síntesis por adelantado; en backend `resident-tts.mjs` la cola FIFO serializa el único modelo ONNX. No se debe anunciar el prefetch actual como una optimización pendiente o afirmar que LUMIA espera siempre al final de reproducción antes de sintetizar el siguiente. Los silencios en la conversación se deben medir con diagnósticos por frase; pueden resultar del tamaño y llegada de fragmentos, los ~1.1–1.6 s del motor, la cola, la carga CPU o reproducción Chrome.

## Qué modifica VA-02.1

**Únicamente telemetría local numérica activada explícitamente con `ORBIA_VA021_KOKORO_PROFILE=1` en el proceso de benchmark**:
1. `bridge/runtime/kokoro/resident.py`: cronometra `EspeakG2P` (G2P), `Kokoro.create` (inferencia ONNX) y `soundfile.write` (WAV) por frase; solo cuando el flag está habilitado incluye `timingsMs` en su respuesta local JSON; WAV, texto, voz y pesos son idénticos.
2. `bridge/orbia/resident-tts.mjs`: valida esos tres números, observa espera en FIFO, vuelta de la petición al worker y lectura WAV, sin modificar las promesas, el modo de síntesis ni el orden. Agrega un snapshot temporal solo de tiempos. No registra textos, fonemas, datos personales ni audio; sin flag, la respuesta del worker conserva su contrato histórico.
3. `scripts/lumia-kokoro-latency-breakdown-va021.mjs`: verifica la carpeta protegida original y el Git limpio del clon, reutiliza el runtime local original en lectura, prepara el modelo residente y sintetiza las **mismas cuatro frases fijas × dos rondas**. No reproduce sonidos ni persiste WAV. Imprime `[VA-02.1]` por frase, medianas y máximos por etapa. Error si cambia el proveedor o si faltan tiempos.
4. `scripts/certify-lumia-va021-kokoro-breakdown.mjs`: prueba puramente sintética de límites y precisión de los tiempos, que el flag no aparece en los lanzadores diarios y que no cambia `sf.write`.

**Interpreta correctamente:** `workerRoundTripMs` incluye los tres pasos Python más comunicación local del trabajador; no sumarlo de nuevo a G2P/ONNX/WAV para estimar el tiempo total. Los tiempos pueden contener algo de instrumentación. `queueWaitMs` indica espera de trabajos locales, `wavReadMs` solo la lectura del archivo generado. Los percentiles son para 8 muestras únicamente: exploración, no estadística de producción.

## Protocolo físico tras CI Windows+Ubuntu PASS

1. Cerrar la ventana del laboratorio VQ-03 con Ctrl+C antes de ejecutar el benchmark; mantener Ollama como esté, no lo necesita para esta medición. No ejecutar simultáneamente más de un Kokoro residente.
2. Verificar `LUMIA-ASUS` en el SHA `1580a5182eba540893e35e37065be77da4ed014c`, y `LUMIA-VQ03-QA` en rama `feature/lumia-vq03-vrm-intent-clarity-20261113`, Git limpio, sin procesos en 5173/8787. No hacer checkout, reset ni clean del original.
3. Actualizar **solo el clon** con `git fetch origin refs/heads/feature/lumia-vq03-vrm-intent-clarity-20261113` seguido de `git merge --ff-only FETCH_HEAD`. Confirmar SHA exacto del run CI aprobado antes de ejecutar.
4. En PowerShell, dentro del clon: `node scripts/certify-lumia-va021-kokoro-breakdown.mjs`; luego `node scripts/lumia-kokoro-latency-breakdown-va021.mjs`. Ambos deben devolver exit 0.
5. Compartir las líneas `[VA-02.1]` únicamente (no archivos privados ni voz).
6. Comparar con p50 1221.9 ms y p95 1599.7 ms **solo como referencia entre ejecuciones en el mismo equipo**, sin afirmar mejora: todavía no existe una variante TTS nueva.

## Decisiones según causa observada

- Si ONNX domina casi todo, estudiar carga y perfil CPU/GPU residente, duración de fragmentos, tamaño del audio, sincronización con otros procesos. No cambiar voz/modelo sin A/B.
- Si G2P es significativo, evaluar caching seguro de fonemas para textos fijos **solo si** hay repetición, sin retener conversaciones privadas.
- Si la cola domina, investigar prefetch y tiempo de encolado del siguiente fragmento, recordando que el prefetch actual ya está encendido. No paralelizar modelos ONNX por defecto.
- Si el WAV/IPC domina, considerar alternativa de transporte **solo en rama QA**, cuidando cancelación y límite de bytes, siempre A/B con mismo audio.
- Si Chrome es principal, una línea base solo Node no puede detectarlo; requerirá diagnóstico del navegador y prueba física.

**Gates adicionales antes de cualquier optimización visible:** los ocho WAV deben generar por el proveedor `kokoro-local-resident`, no haber fallos de voz, no alterar orden, timbre, modelo, velocidad ni cancelación, y no modificar la carpeta original.
