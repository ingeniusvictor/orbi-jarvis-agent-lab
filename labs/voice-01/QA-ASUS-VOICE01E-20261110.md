# LUMIA VOICE-01E — Sweep de umbrales ASUS: sin mejora del conteo (2026-11-10)

> **Estado: FAIL en generalización del conteo automático de 4 hablantes.** Este informe se basa en la tabla PowerShell real compartida por el propietario, que ejecutó los ocho ensayos offline en `LUMIA-VOICE-LAB`. No se han almacenado voces privadas ni biometría. El laboratorio y Qwen/Whisper/Kokoro del producto siguen aislados.

## Comparativa real de umbrales

El mismo motor CPU sherpa-onnx, segmentación Pyannote 3.0 ONNX, embeddings eRes2Net, `--num-speakers -1`. El nuevo parámetro `--cluster-threshold` se pasó explícitamente con valores decimales ASCII. El código de laboratorio se actualizó por fast-forward `7aa455f..2301dc3` antes de la prueba.

| Archivo público de prueba | Hablantes esperados por nombre y ejemplo upstream | Umbral | Clusters devueltos | Segmentos | elapsed_ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| `1-two-speakers-en.wav` | 2 | 0.50 | 2 | 4 | 2831 |
| `1-two-speakers-en.wav` | 2 | 0.55 | 2 | 4 | 3070 |
| `1-two-speakers-en.wav` | 2 | 0.60 | 2 | 4 | 3346 |
| `1-two-speakers-en.wav` | 2 | 0.65 | 2 | 4 | 3397 |
| `0-four-speakers-zh.wav` | 4 | 0.50 | 7 | 10 | 16771 |
| `0-four-speakers-zh.wav` | 4 | 0.55 | 7 | 10 | 16198 |
| `0-four-speakers-zh.wav` | 4 | 0.60 | 7 | 10 | 16543 |
| `0-four-speakers-zh.wav` | 4 | 0.65 | 7 | 10 | 16501 |

**Evidencia:** en esas ocho ejecuciones cambiaron los tiempos, pero **no el conteo ni la cantidad de segmentos**. La tabla no contiene la asignación completa de cada segmento; no podemos afirmar que todas las asignaciones o marcas de tiempo hayan sido idénticas. La muestra de 4 personas sigue sobrecontando por **3 grupos**; la de 2 conserva su conteo correcto. Los tiempos de 16–17 s para el archivo de 56.861 s son compatibles con ejecución offline sub-tiempo-real aislada, **no con latencia útil para respuesta en vivo** sin medir turnos cortos.

## Causa y límites de la hipótesis

Se inspeccionó el código fuente oficial:

- [FastClusteringConfig](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/csrc/fast-clustering-config.h): `num_clusters > 0` ignora `threshold`; si el número se desconoce, menor distancia de corte produce más grupos y mayor distancia de corte tiende a fusionarlos.
- [FastClustering.cpp](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/csrc/fast-clustering.cc): normaliza los embeddings, calcula `1 - cosine_similarity` como distancia, ejecuta agrupación jerárquica de **enlace completo** y aplica `cutree_cdist(..., threshold, ...)` para conteo desconocido; con número positivo usa `cutree_k`.
- [Bindings Python](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/python/csrc/fast-clustering.cc) expone `FastClusteringConfig.threshold`.

Por tanto, **no hay evidencia para afirmar que se ignore el parámetro**. Los umbrales 0.50–0.65 pueden estar dentro de una zona sin alturas de fusión del dendrograma. Otra hipótesis es que segmentos cortos/embeddings poco estables fragmenten una voz. **No se han obtenido embeddings, distancias, referencia humana RTTM ni trazas del árbol**, así que no se puede atribuir la causa de forma definitiva.

## Próximo gate VOICE-01F — aislar agrupación de segmentación

**Experimento 1 — control con información conocida.** Procesar la muestra pública de cuatro personas con `--num-speakers 4`. El motor forzará cuatro grupos (`cutree_k`). Esto es únicamente una **prueba de control** para inspeccionar las marcas de tiempo y la asignación aparente; **no demuestra que sus etiquetas sean correctas**. Comparar los diez segmentos con el análisis automático original y buscar cambios de atribución.

**Experimento 2 — sensibilidad fuera de la meseta.** En modo desconocido `--num-speakers -1` probar, solo en el laboratorio, los cortes 0.75 y 0.85 sobre **ambos** audios. Una modificación en el número de grupos prueba que el umbral afecta al algoritmo en esos datos; si no cambia, será evidencia de un intervalo mayor sin fusiones, **no prueba de bug en API**. Nunca promover estos valores como configuración general sin holdout.

**Experimento 3 — validación independiente.** Para cualquier umbral elegido, aportar audios distintos de 1/2/4 adultos consentidos, anotaciones humanas para speaker-turn/error y medidas CPU/RAM. Si el conteo se ajusta a 4 por casualidad pero fusiona dos voces reales, el resultado debe considerarse fallido.

Estos experimentos no cambian producción ni el comportamiento por defecto de `offline_diarization.py` (`threshold=0.5`), no abren micrófono ni involucran identificación de familiares. No activar VOICE-02 en vivo.

## Comando reproducible VOICE-01F

Desde cualquier carpeta PowerShell, con los modelos y audios públicos ya descargados y el worktree existente:

~~~powershell
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$py = Join-Path $data ".venv\Scripts\python.exe"
$script = Join-Path $lab "labs\voice-01\offline_diarization.py"
$seg = Join-Path $data "models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx"
$emb = Join-Path $data "models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
$two = Join-Path $data "samples\1-two-speakers-en.wav"
$four = Join-Path $data "samples\0-four-speakers-zh.wav"

# Control: cuatro grupos FIJADOS sobre la muestra pública de cuatro voces.
& $py -B $script --wav $four --segmentation-model $seg --embedding-model $emb --num-speakers 4 --consent
if ($LASTEXITCODE -ne 0) { throw "Falló control fijo k=4." }

# Sensibilidad: umbrales nuevos, conteo DESCONOCIDO, ambas muestras públicas.
foreach ($wav in @($two, $four)) {
    foreach ($threshold in @("0.75", "0.85")) {
        Write-Host ("AUTO threshold={0}, sample={1}" -f $threshold, (Split-Path -Leaf $wav))
        & $py -B $script --wav $wav --segmentation-model $seg --embedding-model $emb --num-speakers -1 --cluster-threshold $threshold --consent
        if ($LASTEXITCODE -ne 0) { throw "Falló diarización experimental." }
    }
}
~~~

La salida completa conserva los segmentos y permite distinguir conteo vs asignación; **no comparar etiquetas `speaker_0` entre ejecuciones como si fueran personas persistentes**.

Referencias: [VOICE-01B](QA-ASUS-VOICE01B-20261109.md), [VOICE-01C](QA-ASUS-VOICE01C-20261109.md), [VOICE-01D](QA-ASUS-VOICE01D-20261109.md), [Issue #78](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78), [PR #79 en borrador](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79).
