# VA-02.0 — Línea base de Kokoro residente, separada de VQ-03.5

**Fecha:** 14-11-2026. **Estado:** solo herramienta opcional de medición en clon `LUMIA-VQ03-QA`; no modifica el motor TTS, el parser, Qwen ni Motion R8. No escribe en el original `LUMIA-ASUS` y no fusiona el PR #83.

## Evidencia física que motivó VA-02

La última prueba por voz en ASUS experimental recibió `whisper-local` y respondió al tema de animaciones con mejoras claras. Aún transcribió `una batar VRM` (Whisper imperfecto) y la respuesta Qwen dijo innecesariamente que el avatar «se mueve usando IA», cuando un VRM puede moverse sin IA. Las dos preguntas sobre naturalidad y **control durante conversación** generaron respuestas distintas y razonables; no ofrecieron simulaciones inexistentes.

| Turno | Primer texto | Primer audio | Mayor pausa Kokoro/WAV entre fragmentos |
| --- | ---: | ---: | ---: |
| «una batar VRM» | 2.40 s | 5.50 s | 0 ms |
| «animaciones más naturales» | 2.58 s | 5.34 s | **573 ms** |
| «control mientras conversamos» | 2.62 s | 4.19 s | **0 ms** (pero Chrome tuvo 201 ms de pausa en un fragmento) |

En una ronda anterior, otras frases acumularon pausas Kokoro/WAV de **1.110, 1.088 y 1.554 ms**. **No afirmar que el TTS ha mejorado porque las frases y segmentaciones no son idénticas.** El tiempo de texto no incluye latencia física del habla.

## Qué hace el benchmark

`scripts/lumia-kokoro-latency-baseline-va02.mjs` mide **cuatro frases fijas en español, dos rondas cada una** después de una síntesis de precalentamiento. Usa el motor Python+Kokoro **residente actual** mediante `synthesizeLocalSpeech`, sin voz del navegador. Mide por fragmento el tiempo del llamado completo que incluye síntesis residente, lectura y limpieza del WAV temporal. Reporta p50, p95 y máximo en milisegundos. Valida que el proveedor realmente sea `kokoro-local-resident` y que la salida sea WAV.

**No hace** micrófono, video, cámara, reproducción, red, escritura de WAV persistente, descarga de modelos ni cambio de configuración de la instalación principal. Reutiliza los pesos ya instalados en lectura; los WAV temporales son limpiados por el adaptador existente. El proceso residente puede ocupar CPU y RAM mientras se ejecuta, por lo que **cerrar antes LUMIA** y no ejecutar otros benchmarks simultáneamente. Los cálculos de mediana NO deben interpretarse como la latencia del primer audio en Chrome ni el silencio audible entre fragmentos.

## Procedimiento ASUS, solo después de CI PASS para el SHA de la revisión

1. Cerrar la ventana del clon y la consola de bridge con Ctrl+C. Mantener Ollama abierto; no se necesita para este benchmark.
2. Verificar `LUMIA-ASUS` en `1580a5182eba540893e35e37065be77da4ed014c` y respaldo LM-01 existente. Verificar rama del clon `feature/lumia-vq03-vrm-intent-clarity-20261113`, `git status --porcelain` vacío y 5173/8787 libres.
3. Actualizar **solo el clon** con `git -C "$env:USERPROFILE\LUMIA-VQ03-QA" fetch origin "refs/heads/feature/lumia-vq03-vrm-intent-clarity-20261113"` y `git -C "$env:USERPROFILE\LUMIA-VQ03-QA" merge --ff-only FETCH_HEAD`. Comprobar SHA HEAD contra certificado CI.
4. Ejecutar desde ese clon, **con la LUMIA experimental detenida**:

```powershell
Push-Location "$env:USERPROFILE\LUMIA-VQ03-QA"
try {
  node .\scripts\certify-lumia-va02-kokoro-baseline.mjs
  if ($LASTEXITCODE -ne 0) { throw 'VA02 synthetic test failed.' }
  node .\scripts\lumia-kokoro-latency-baseline-va02.mjs
  if ($LASTEXITCODE -ne 0) { throw 'VA02 physical baseline failed.' }
} finally { Pop-Location }
```

5. Compartir solo líneas `[VA-02]` de duración, mediana y p95. No guardar ni subir WAV. No ejecutar el instalador de voz ni reemplazar pesos.
6. Volver al lanzador VQ-03.3 de voz **después** de cerrar el benchmark, para no tener dos Kokoro residentes compitiendo. No hacer pruebas de rendimiento con ambas instancias abiertas.

## Condiciones de aprobación

- [ ] Windows+Ubuntu CI de los tests sintéticos PASS.
- [ ] ASUS real: las cuatro frases × dos rondas ejecutan únicamente `kokoro-local-resident` sin fallback.
- [ ] Medidas por frase y agregados recopilados, sin compararlas aún con un candidato nuevo.
- [ ] Siguiente estudio A/B: idénticas frases, mismo peso/voz/modelo, una sola variable de síntesis o cola modificada, sin tocar `LUMIA-ASUS`.
- [ ] Mantener separado el control de comprensión VRM/VRAM, el QA visual Motion R8 y el control de pausas del navegador.

**Limite:** el benchmark es **línea base sin optimización**, no certificación de mejora en WAV ni de la calidad del habla. El audio que se escucha y las interrupciones perceptibles requieren posterior prueba de conversación real con mismos fragmentos.
