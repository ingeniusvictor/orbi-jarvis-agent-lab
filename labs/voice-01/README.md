# LUMIA VOICE-00 / VOICE-01 — Laboratorio multihablante aislado

**Estado (9 nov 2026, VOICE-01C):** laboratorio offline experimental **instalado y probado físicamente en ASUS** con la misma grabación pública de 16 s en dos modalidades: 2 hablantes **fijados** (VOICE-01B: 4 segmentos en 3.013 s) y **estimación automática con `--num-speakers -1`** (VOICE-01C: 2 hablantes, mismos 4 segmentos, 2.352 s). **No** está integrado al micrófono ni a LUMIA en vivo; falta generalización sobre más grabaciones, evaluación contra anotaciones humanas, español, solapamientos y política de destinatario. No cambia los lanzadores, Whisper.cpp, Kokoro, Qwen3.5 2B, avatar ni permisos. No activa identificación vocal ni facial.

**QA física:** [VOICE-01B: primer motor y hashes](QA-ASUS-VOICE01B-20261109.md) · [VOICE-01C: conteo automático y próximos gates](QA-ASUS-VOICE01C-20261109.md).

> **ATENCIÓN — VOICE-01D (09-11-2026):** La prueba física ASUS con la muestra pública **de cuatro hablantes** y `--num-speakers -1` estimó **7 voces en lugar de 4** (`segment_count=10`, `elapsed_ms=16451`, archivo 56.861 s). La inferencia terminó con exit 0, pero **la calidad del conteo automático FALLÓ**. Ver [informe de QA y parámetros de agrupamiento](QA-ASUS-VOICE01D-20261109.md). El valor predeterminado `cluster_threshold=0.5` no cambia; el nuevo parámetro experimental `--cluster-threshold` requiere uso explícito. **No dar por certificada la generalización multihablante ni integrar en vivo.**

> **VOICE-01E (10-11-2026) — calibración inicial NO RESUELTA:** en ASUS se probaron `--cluster-threshold 0.50, 0.55, 0.60, 0.65` sobre muestras públicas de 2 y 4 hablantes, ocho ejecuciones reales. El conteo fue **2/2** en la muestra corta y **7/4** en la de cuatro hablantes en todos los valores. La API C++ sí utiliza el umbral como distancia de corte en agrupamiento jerárquico (enlace completo), pero el rango probado no cambió los conteos. **No cambiar el umbral predeterminado ni integrar en vivo.** [Ver tabla real, análisis upstream y VOICE-01F diagnóstico](QA-ASUS-VOICE01E-20261110.md).

Seguimiento y continuidad: https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78

## Repositorios elegidos para fork

La conexión GitHub de este chat NO dispone de la acción Fork. Aún no se ha ejecutado ningún fork. Para conservar los proyectos en GitHub, abrir sus repositorios, pulsar **Fork**, elegir la cuenta personal y confirmar:

- PRIORIDAD: https://github.com/k2-fsa/sherpa-onnx — Apache-2.0 para el código; diarización OFFLINE mediante CPU ONNX.
- COMPARACIÓN: https://github.com/pyannote/pyannote-audio — MIT para el código; Community-1 tiene licencia de pesos CC BY 4.0 y condiciones de acceso separadas.
- REUNIONES: https://github.com/m-bain/whisperX — BSD-2-Clause para el código; alineación ASR con diarización vía pyannote.

No clonar ni instalar estas bibliotecas para probar este laboratorio. Un fork del repositorio no resuelve las licencias de los pesos.

## Arquitectura

- ASR/Whisper.cpp: qué palabras se dicen.
- Diarización: qué **hablante anónimo** intervino y cuándo.
- Gestión de destinatario: si alguien se dirige a LUMIA. No puede inferirse con seguridad solo de la diarización.
- Identificación de voz: opcional y distinta, NO implementada.

LUMIA ya utiliza VAD, Voice Focus, Household Focus y Speaker Shield. Estos módulos pueden evitar ecos, pero también descartar capturas mientras habla Kokoro. No reemplazarlos ni abrir un segundo micrófono; primero medir el comportamiento real.

## VOICE-00 — Baseline privado

Preparar WAV de adultos consentidos y anotaciones de referencia RTTM FUERA DE GIT. Escenarios: 1 hablante, 2 alternos, 3–4 alternos, 2 simultáneos, TV/voz lejana, interrupciones y voz de Kokoro audible.

RTTM sintético, solo un ejemplo:

~~~text
SPEAKER prueba 1 0.0 1.2 <NA> <NA> p1 <NA> <NA>
SPEAKER prueba 1 1.3 1.5 <NA> <NA> p2 <NA> <NA>
~~~

Pruebas sin modelos ni archivos personales:

~~~powershell
cd C:\Users\ingvm\LUMIA-ASUS
& "$env:LOCALAPPDATA\ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe" -B -m unittest discover -s .\labs\voice-01\tests -p "test_*.py" -v
py -3.11 .\labs\voice-01\voice00_metrics.py --reference $rttmReal --predicted $rttmPredicho
~~~

La segunda instrucción solo debe ejecutarse tras configurar las rutas privadas en variables. La métrica es **frame_error_proxy_nonoverlap_not_standard_DER**: no equivale a DER estándar; omite cuadros de referencia con voces simultáneas, declara cuántos omitió y mide errores en cuadros de 10 ms. No se divulgan nombres ni rutas.

## VOICE-01 — sherpa-onnx offline opt-in

El script offline_diarization.py no utiliza micrófono, cámara ni internet; requiere consentimiento explícito y WAV PCM16 mono de 16 kHz, máximo 10 minutos. No persiste archivos ni reconoce nombres.

Primero ejecutar:

~~~powershell
& "$env:LOCALAPPDATA\ORBI\LUMIA-VOICE-LAB\.venv\Scripts\python.exe" -B .\labs\voice-01\offline_diarization.py --doctor
~~~

Solo cuando se autorice una instalación de laboratorio aislada:

~~~powershell
# Método vigente en ASUS, sin depender de py -3.11:
.\labs\voice-01\prepare-models-asus.ps1 -Bootstrap
$voicePy = "$env:LOCALAPPDATA\ORBI\LUMIA-VOICE-LAB\.venv\Scripts\python.exe"
~~~

Los modelos ONNX se obtienen voluntariamente de la fuente oficial, se valida su SHA y licencia: https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/index.html. El wrapper sigue el ejemplo oficial https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/offline-speaker-diarization.py, con segmentación Pyannote 3.0 y embeddings 3D-Speaker 16 kHz. Los dos modelos oficiales y la muestra pública **ya fueron descargados y procesados correctamente en ASUS**, como acredita la [QA real](QA-ASUS-VOICE01B-20261109.md); estos comandos permanecen opcionales y aislados.

Después de preparar audio privado con consentimiento y los modelos oficiales:

~~~powershell
& $voicePy ".\labs\voice-01\offline_diarization.py" --wav $wavPrivado --segmentation-model $modeloSegmentacion --embedding-model $modeloEmbeddings --num-speakers 2 --consent
~~~

Este comando es para una **prueba futura**, no se ejecuta durante CI. Produce segmentos de tiempo y etiquetas anónimas, que también se deben manejar de forma privada. No hay garantía de rescatar simultáneamente dos voces desde un micrófono.

## Pendientes y gates

1. Completar los forks desde la UI de GitHub y verificar sus URL exactas.
2. VOICE-00: preparar, con consentimiento, pequeños datasets reales y etiquetado independiente. Medir errores de atribución y cuándo LUMIA no debería responder.
3. VOICE-01: autorización del propietario, venv aislado, pesos verificados con licencias propias, ejecutar en Ryzen 7 CPU y luego ASUS midiendo precisión, RAM/CPU y tiempo por minuto.
4. VOICE-02: solo después de buenos resultados, evaluar atribución de turnos en vivo sin bloquear Whisper/Kokoro ni duplicar micrófono.
5. VOICE-03: identidad vocal opcional de adultos consentidos, cifrado y borrado. Unknown por defecto, nunca autenticación de alto impacto.
6. VOICE-04: política de destinatario, eco y barge-in real. VOICE-05: reuniones con permiso y exportación voluntaria.

**No fusionar a main, no alterar el launcher ASUS y no proclamar diarización física a partir de CI sintética.**


## VOICE-01B — Instalación aislada de modelos oficiales (9 nov 2026)

Se añadió [prepare-models-asus.ps1](prepare-models-asus.ps1): prepara voluntariamente el motor, los dos modelos ONNX y una prueba pública de dos hablantes, sin modificar LUMIA. NO está demostrado todavía que se haya ejecutado físicamente en la ASUS.

Comandos desde el worktree separado, para evitar modificar la instalación principal:

~~~powershell
cd "$env:USERPROFILE\LUMIA-VOICE-LAB"
if (git status --porcelain) { throw "Existen cambios locales; revisar antes de actualizar." }
git fetch origin feature/lumia-voice01-offline-diarization-lab-20261109
if ($LASTEXITCODE -ne 0) { throw "Falló fetch." }
git merge --ff-only FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw "Falló merge." }

.\labs\voice-01\prepare-models-asus.ps1 -Bootstrap -DownloadModels -DownloadSample -RunDemo
~~~

Si el sistema bloquea scripts PowerShell, únicamente tras revisar este archivo, puede utilizarse PowerShell -NoProfile con -ExecutionPolicy Bypass **solo para ese proceso**; nunca modificar la política global.

El script encuentra el ejecutable Python base mediante el venv anterior de FACE-LAB: no requiere el comando py -3.11 que falló en la ASUS. Crea un venv nuevo en %LOCALAPPDATA%\ORBI\LUMIA-VOICE-LAB, instala sherpa-onnx 2.0.1 allí y guarda los pesos y la grabación pública fuera de Git.

- -Bootstrap: crea/prepara venv privado sin alterar Whisper/Kokoro/DeepFace
- -DownloadModels: descarga segmentación + extractor de embeddings de los releases oficiales
- -DownloadSample: baja la demostración pública de dos hablantes (en inglés)
- -RunDemo: ejecuta el análisis offline sobre esa demostración, sin micrófono

Activos verificados contra GitHub Releases (tamaño publicado, no hash externo):

| Archivo | Release | Tamaño |
| --- | --- | ---: |
| sherpa-onnx-pyannote-segmentation-3-0.tar.bz2 | speaker-segmentation-models | 6 958 444 bytes |
| 3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx | speaker-recongition-models (tag escrito así upstream) | 39 593 761 bytes |
| 1-two-speakers-en.wav | speaker-segmentation-models | 512 044 bytes |

**Limitación de integridad:** estas versiones antiguas no exponen SHA256 publicado mediante GitHub API. Se verifican tamaños, estructura del archivo tar, formato del modelo y se imprimen hashes SHA256 locales para una auditoría posterior, pero esto NO constituye comparación con un checksum publicado. Los pesos tienen términos separados de la licencia del código; no redistribuirlos sin revisar el origen.

**Completado:** primera ejecución real de una muestra pública en ASUS con `--num-speakers 2`. **Completado:** conteo automático `--num-speakers -1` en **una muestra pública** con dos hablantes, con segmentos idénticos al ensayo de conteo fijado. **Pendiente:** generalizar a grabaciones diferentes (1/2/4 hablantes), anotaciones independientes, medidas RAM/CPU, español y política de destinatario antes de integrar en vivo. No confundir PASS de tests sintéticos con diarización real.
