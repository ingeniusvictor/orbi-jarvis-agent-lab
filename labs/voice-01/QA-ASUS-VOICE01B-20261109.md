# LUMIA VOICE-01B — Primera ejecución REAL offline en ASUS (09-11-2026)

> **Evidencia directa:** salida de PowerShell compartida por el propietario después de ejecutar el laboratorio independiente `LUMIA-VOICE-LAB`. Este documento conserva los resultados de la prueba física sin incluir grabaciones privadas, voces familiares, perfiles biométricos ni rutas de datos personales.

## Estado del experimento

- **PASS — Instalación/importación:** `SHERPA ONNX IMPORT OK`; `sherpa_installed:true`. Entorno Python aislado creado en `%LOCALAPPDATA%/ORBI/LUMIA-VOICE-LAB/.venv`; no sustituye Whisper.cpp, Kokoro, Ollama ni los demás módulos de LUMIA.
- **PASS — Activos presentes:** `Segmentation model ready: True`, `Speaker embeddings ready: True`, `Official public sample ready: True`. El script verificó el tamaño publicado de cada descarga y registró SHA256 local. Los releases antiguos no exponen digest oficial, por tanto los hashes locales no se han contrastado con un SHA upstream.
- **PASS — Primer proceso real del motor:** `"ok":true`, `"mode":"offline-cpu-file"`, `"duration_s":16.0`, `"elapsed_ms":3013`, `"segment_count":4` y `"speaker_count":2`.
- **Seguridad/integración:** `"files_written":0`, `"identity_confirmed":false`, `"recognition_enabled_in_lumia":false`; no se abrió micrófono y no se cambió el runtime activo.
- **Limitación fundamental:** se ejecutó `--num-speakers 2`, es decir, el número de agrupaciones **se le indicó al algoritmo**. Esto **NO demuestra detección automática del número de participantes**. La asignación de etiquetas tampoco está validada contra una anotación humana de referencia; no reportar precisión, DER ni identificación por nombre.

## Versiones y fuentes

- Rama de laboratorio: `feature/lumia-voice01-offline-diarization-lab-20261109`.
- Commit probado en la ASUS: `7aa455fcb09c56267008ebe7aae5121601cb96bb` (fast-forward `a059299..7aa455f`).
- Fuente sherpa-onnx 2.0.1 mediante `requirements-optional.txt`; **la salida acredita importación sherpa pero no imprime su versión exacta**. Antes de certificar una versión instalada, consultar su metadato con `importlib.metadata`.
- Muestra: `1-two-speakers-en.wav`, público de GitHub Release `speaker-segmentation-models`.
- Segmentación: `sherpa-onnx-pyannote-segmentation-3-0.tar.bz2`.
- Embeddings: `3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx`.

| Activo público | SHA-256 local de ASUS |
| --- | --- |
| Segmentación, tar.bz2 | `24615EE884C897D9D2BA09BB4D30DA6BB1B15E685065962DB5B02E76E4996488` |
| Extractor eRes2Net, ONNX | `1A331345F04805BADBB495C775A6DDFFCDD1A732567D5EC8B3D5749E3C7A5E4B` |
| Muestra WAV de dos hablantes | `F1C877DC01595E28BE7147BF2FE38E5268147A868BF3FDB5C37B97F5940E21F3` |

Estos SHA sirven para reproducibilidad **local**, no son pruebas de autenticidad frente a un checksum publicado.

## Segmentos que produjo sherpa-onnx

| Hablante anónimo | Inicio (s) | Fin (s) |
| --- | ---: | ---: |
| `speaker_0` | 1.583 | 3.406 |
| `speaker_0` | 4.402 | 6.460 |
| `speaker_1` | 9.346 | 11.472 |
| `speaker_1` | 12.164 | 14.645 |

Tiempo de inferencia/procesamiento reportado por el script: **3.013 s** para **16 s** de audio público; factor de tiempo real aproximado `3013 / 16000 = 0.1883`, rendimiento aproximado `5.31 ×` tiempo real. **Solo una medición**; falta repetir para estimar variabilidad. No se midieron pico RAM/CPU, ejecución concurrente con Qwen, precisión de etiquetas ni calidad sobre español.

## Incidencia resuelta antes del PASS

La primera ejecución fallaba en la instrucción PowerShell 5.1 `python -c` por comillas anidadas y producía `SyntaxError: '(' was never closed`. El código se corrigió en `57af7499`; la prueba nativa de PowerShell 5.1 y el YAML del workflow se repararon, commit `7aa455fc`. El propietario descargó ese HEAD y la importación **PASS** en la ASUS. No requiere actualizar pip ni reinstalar el motor.

## Siguiente gate: modo desconocido de 2 hablantes

Ejecutar la **misma** muestra pública con `--num-speakers -1` para dejar que el clustering estime el número, o no pasar ese argumento (valor por defecto `-1`). Si devuelve 2, eso aporta evidencia inicial de detección automática **en una sola grabación**. Si devuelve 1 o 3+, registrar el fallo con transparencia y comparar umbrales antes de integrarlo. Repetir en más muestras públicas y luego en español con adultos consentidos.

Ejemplo seguro desde cualquier directorio (la ubicación es del laboratorio, nunca de la app principal):

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$private = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$py = Join-Path $private ".venv\Scripts\python.exe"
$seg = Join-Path $private "models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx"
$emb = Join-Path $private "models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
$wav = Join-Path $private "samples\1-two-speakers-en.wav"
& $py -B (Join-Path $lab "labs\voice-01\offline_diarization.py") --wav $wav --segmentation-model $seg --embedding-model $emb --num-speakers -1 --consent
~~~

Este ensayo continúa **offline**, no abre cámara/micrófono, no registra personas, no guarda nuevos archivos y no toca `main` ni el PR de reconocimiento facial.

## Pendientes prioritarios

1. VOICE-01C: clustering automático con la muestra pública y, luego, otras grabaciones públicas de 1/2/4 personas; medir conteo correcto, turnos y latencias repetidas.
2. VOICE-00: disponer de anotaciones de referencia independientes para atribución temporal; reportar errores, no solo que `speaker_count` coincide.
3. Ensayos en español con varias personas **adultas consentidas**, sin datos biométricos en Git; distinguir turnos hablados vs transcripción, destinatario y eco de Kokoro.
4. Medir uso de RAM/CPU e interferencia con Qwen2B/Whisper/Kokoro **solo en una fase posterior**; VOICE-02 en vivo sigue sin integrarse ni autorizarse.
5. Forks de sherpa-onnx, pyannote.audio y WhisperX siguen pendientes de verificación y no afectan al laboratorio funcional.

**Criterio de cierre de este hito:** el motor de diarización **funciona offline en una muestra pública en ASUS con número conocido de hablantes**. No equivale a que LUMIA comprenda conversaciones simultáneas en producción.
