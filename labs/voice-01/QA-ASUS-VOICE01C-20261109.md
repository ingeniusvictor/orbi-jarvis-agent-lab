# LUMIA VOICE-01C — Estimación automática de hablantes, prueba REAL ASUS (2026-11-09)

> **Resultado experimental PASS en una única grabación pública.** El usuario ejecutó en su ASUS el laboratorio sherpa-onnx aislado, esta vez con `--num-speakers -1` (sin fijar previamente el número de participantes). La grabación original se publicó por el proyecto sherpa-onnx; **no se usaron audios de familiares ni voz privada**. La salida se compartió en la conversación y se registra aquí para continuidad.

## Evidencia física del experimento

- Motor: sherpa-onnx offline CPU en entorno virtual propio `%LOCALAPPDATA%\ORBI\LUMIA-VOICE-LAB\.venv`.
- Wrapper existente: `labs/voice-01/offline_diarization.py`. No se modificó el algoritmo de diarización en esta prueba.
- Dataset: archivo público `1-two-speakers-en.wav`, duración reportada **16.0 s**.
- Segmentación: `sherpa-onnx-pyannote-segmentation-3-0/model.onnx`.
- Embeddings: `3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx`.
- Parámetro **clave**: `--num-speakers -1` (agrupamiento de número desconocido, a diferencia de VOICE-01B que usó `--num-speakers 2`).
- Respuesta real del ejecutable: `ok:true`, `mode:"offline-cpu-file"`, `speaker_count:2`, `segment_count:4`, `elapsed_ms:2352`; `files_written:0`, `identity_confirmed:false`, `recognition_enabled_in_lumia:false`; código de salida del proceso **0**.
- No se encendió el micrófono ni se cargó LUMIA en vivo. No se cambió el modelo Qwen 2B, Whisper, Kokoro, interfaz, avatar ni `main`.

## Turnos anónimos estimados

| Hablante de este archivo | Inicio (s) | Fin (s) |
| --- | ---: | ---: |
| speaker_0 | 1.583 | 3.406 |
| speaker_0 | 4.402 | 6.460 |
| speaker_1 | 9.346 | 11.472 |
| speaker_1 | 12.164 | 14.645 |

**Comparación A/B en la ASUS, mismo WAV y mismos modelos**:

| Prueba | Clustering | Conteo emitido | Segmentos | Tiempo reportado | RTF aproximado |
| --- | --- | ---: | ---: | ---: | ---: |
| VOICE-01B | `--num-speakers 2` (fijado) | 2 | 4 | 3013 ms | 0.1883 |
| VOICE-01C | `--num-speakers -1` (automático) | 2 | 4 | 2352 ms | 0.1470 |

Se reprodujeron **exactamente** los mismos intervalos y etiquetas, y el conteo automático coincidió con los dos participantes esperados en esta muestra pública. Diferencia de tiempo: **661 ms**; una observación aislada, susceptible de efectos de calentamiento de modelo, caché y carga. No es una comparación estadística válida de rendimiento o exactitud.

## Qué queda validado (y qué NO)

**Validado físicamente:** la instalación local de sherpa-onnx en ASUS y la capacidad de procesar **un** archivo público de dos voces sin conocer el número de hablantes, con resultado coherente y cuatro segmentos; aislamiento del motor respecto al runtime normal de LUMIA.

**NO validado:** estimación fiable para otras grabaciones, conteos 1/3/4, calidad DER contra anotaciones de referencia, turnos con voces superpuestas, cambios rápidos de hablante, español, ambiente doméstico, varios micrófonos, streaming, identificación individual por nombre, coincidencia de voz contra personas ni decisión de cuándo responder. Tampoco se midió RAM/CPU bajo carga con Qwen 2B + Kokoro/Whisper.

**Privacidad:** los identificadores `speaker_0`/`speaker_1` son etiquetas arbitrarias por archivo, no una identidad biométrica persistente. El motor no ha enrolado perfiles de voz ni creado archivos nuevos durante la prueba.

## Siguiente hito propuesto: VOICE-01D, generalización y referencia

1. Probar un **WAV público distinto** con dos hablantes (`2-two-speakers-en.wav`) con `--num-speakers -1`, comparar número estimado y segmentación; no asumir que el nombre del archivo es una verdad-terreno detallada.
2. Probar el archivo público `0-four-speakers-zh.wav` con `--num-speakers -1` para comprobar si distingue cuatro participantes sin fijarlos. Documentar si devuelve un número incorrecto, no manipular el umbral para reportar PASS.
3. Repetir cada caso varias veces, medir duración, RTF, memoria/CPU y estabilidad. Obtener referencia RTTM humana o publicada antes de calcular precisión de atribución.
4. Solo después, audio español de **adultos consentidos** preparado fuera de Git; separar análisis de diarización vs Whisper (palabras) vs política de destinatario.
5. Mantener VOICE-02 (diarización en vivo), VOICE-03 (identidad vocal) y VOICE-04 (interrupciones/eco) **pendientes**, sin instalar un segundo micrófono ni eliminar Speaker Shield.

## Comando de regresión reutilizando el audio público ya instalado

~~~powershell
$data = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-VOICE-LAB'
$lab = Join-Path $env:USERPROFILE 'LUMIA-VOICE-LAB'
& (Join-Path $data '.venv\Scripts\python.exe') -B (Join-Path $lab 'labs\voice-01\offline_diarization.py') --wav (Join-Path $data 'samples\1-two-speakers-en.wav') --segmentation-model (Join-Path $data 'models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx') --embedding-model (Join-Path $data 'models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx') --num-speakers -1 --consent
~~~

**Seguimiento:** [Issue #78](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78), [PR #79 en borrador](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79), [QA previa VOICE-01B](QA-ASUS-VOICE01B-20261109.md). Esta documentación no autoriza cambios de producción ni merges.
