# LUMIA VOICE-01D — Prueba ASUS con cuatro hablantes: sobresegmentación (2026-11-09)

> **ESTADO: FALLO DE CALIDAD DEL CONTEO AUTOMÁTICO, AUNQUE LA INFERENCIA COMPLETÓ SIN ERROR.** Los resultados de este documento proceden de la salida PowerShell real entregada por el propietario. No se almacenan audios privados, voces familiares, plantillas biométricas ni nombres de personas. Este ensayo **NO** habilita reconocimiento por voz en LUMIA.

## Evidencia ASUS

- WAV oficial de `k2-fsa/sherpa-onnx`: `0-four-speakers-zh.wav`, archivo público de muestra de **cuatro hablantes**, **1 819 586 bytes**, audio de **56.861 s**.
- Modelos: `sherpa-onnx-pyannote-segmentation-3-0/model.onnx` + `3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx`, CPU aislado.
- Se ejecutó el script original de laboratorio `labs/voice-01/offline_diarization.py` con `--num-speakers -1 --consent`, con clustering automático de umbral fijo **0.5**.
- El JSON reportó `ok:true`, `mode:"offline-cpu-file"`, `speaker_count:7`, `segment_count:10`, `elapsed_ms:16451`, `files_written:0`, `identity_confirmed:false`, `recognition_enabled_in_lumia:false`; `$LASTEXITCODE = 0`.
- **Resultado de calidad: 7 etiquetas estimadas frente a 4 hablantes previstos según el ejemplo oficial**. Sobresegmentación del agrupamiento; no confundir `ok:true` ni el código de salida 0 con éxito de detección automática.
- Rendimiento observado: `16451 / (56.861 * 1000) = 0.2893` RTF, equivalente a aproximadamente **3.46× tiempo real** en esta prueba aislada. Una medición, sin RAM/CPU pico ni variabilidad.

## Salida original de segmentos

| Etiqueta anónima | Inicio (s) | Fin (s) |
| --- | ---: | ---: |
| speaker_0 | 0.318 | 6.865 |
| speaker_1 | 7.017 | 10.747 |
| speaker_1 | 11.455 | 13.632 |
| speaker_2 | 13.750 | 17.041 |
| speaker_3 | 22.137 | 24.837 |
| speaker_4 | 27.638 | 29.478 |
| speaker_4 | 30.001 | 31.553 |
| speaker_5 | 33.967 | 37.932 |
| speaker_6 | 48.040 | 50.470 |
| speaker_0 | 52.529 | 54.605 |

Estas etiquetas son arbitrarias **por archivo** y no asignan identidades reales. Sin anotaciones de referencia independientes no se puede cuantificar cuántos de los segmentos se atribuyeron al hablante correcto, ni detectar todas las omisiones, ni calcular DER estándar. Los intervalos sin etiquetas no prueban que hubiese silencio genuino.

## Diagnóstico técnico e hipótesis

El ejemplo upstream de sherpa-onnx `python-api-examples/offline-speaker-diarization.py` documenta que, cuando `num_speakers=-1`, `FastClusteringConfig.threshold` controla la cantidad de grupos: **umbral menor → más clusters; mayor → menos clusters**. El ejemplo oficial para el propio archivo de cuatro personas fuerza `num_speakers=4` y usa `threshold=0.5` como parámetro por defecto si el número se desconoce.

Por ello es plausible que `threshold=0.5` esté separando en exceso voces de esta muestra, pero **no está comprobado que sea la única causa**. Calidad de embeddings, cambios de tono/idioma, segmentación y solapamiento podrían contribuir. El éxito de VOICE-01C con 2 personas en 16 segundos **no generalizó** automáticamente a la muestra de cuatro personas de 56.861 segundos.

## Corrección experimental en el PR #79

- `offline_diarization.py` permite `--cluster-threshold FLOAT` (estrictamente entre 0 y 1, valor por defecto 0.5). El parámetro se pasa a `FastClusteringConfig` solamente cuando el usuario ejecuta el comando.
- La salida del laboratorio incluye `num_speakers_requested` y `cluster_threshold`, para que los resultados sean reproducibles y no se confundan pruebas con número fijado vs automático.
- Tests sintéticos verifican el uso del umbral y rechazan valores no finitos/fuera de rango; no descargan modelos ni utilizan voces privadas.
- No se cambia el default, no se introduce reconocimiento en vivo, no se modifican `voice.ts`, VAD, Whisper, Kokoro, Qwen 2B, avatar, launchers ni `main`.

## VOICE-01E — Evaluación controlada pendiente

Probar **ambas grabaciones públicas** en el mismo motor con umbrales **0.50 (control), 0.55, 0.60 y 0.65**, y `--num-speakers -1`. Registrar `speaker_count`, `segment_count`, `elapsed_ms` y código de salida para cada pareja audio/umbral. No asumir que mayor umbral siempre produce exactamente cuatro, ni ajustar hasta acertar únicamente el archivo conocido; comparar especialmente que la muestra de dos hablantes no colapse a uno.

No convertir los resultados de un solo archivo en un umbral universal. Una nueva muestra debe actuar como validación independiente (holdout), idealmente con anotaciones humanas de turnos y clips en español de adultos consentidos. No seleccionar por número de clusters únicamente; cuando haya una referencia, calcular errores de atribución.

Comandos desde PowerShell después de actualizar el **worktree** independiente:

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$python = Join-Path $data ".venv\Scripts\python.exe"
$script = Join-Path $lab "labs\voice-01\offline_diarization.py"
$seg = Join-Path $data "models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx"
$emb = Join-Path $data "models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
$sample2 = Join-Path $data "samples\1-two-speakers-en.wav"
$sample4 = Join-Path $data "samples\0-four-speakers-zh.wav"

foreach ($target in @($sample2, $sample4)) {
  foreach ($threshold in @(0.50, 0.55, 0.60, 0.65)) {
    Write-Host ("=== THRESHOLD {0:F2} ===" -f $threshold)
    & $python -B $script --wav $target --segmentation-model $seg --embedding-model $emb --num-speakers -1 --cluster-threshold $threshold --consent
    if ($LASTEXITCODE -ne 0) { throw "VOICE-01E experimental run failed." }
  }
}
~~~

**Verificación y continuidad:** [Issue #78](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78), [PR #79](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79), [QA PASS dos hablantes](QA-ASUS-VOICE01C-20261109.md). **VOICE-01D no debe aparecer como éxito de diarización automática de cuatro voces.**
