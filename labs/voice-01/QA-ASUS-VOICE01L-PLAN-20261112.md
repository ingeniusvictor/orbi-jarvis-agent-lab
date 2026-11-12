# VOICE-01L — estabilidad temporal CAM++ con ventanas iguales (12-11-2026)

## Objetivo y motivación

En VOICE-01J el propietario juzgó por oído C≈A y D≈A. En VOICE-01K sobre el WAV público `3-two-speakers-en.wav`, los cosenos de 5–6 s por fragmento fueron: A-B=0.39515, A-C=0.73412, A-D=0.81847, B-C=0.34419, B-D=0.34815, C-D=0.75023 (1108 ms en ASUS). Las ventanas tenían duraciones desiguales (A=5 s, B=6 s, C=3 s, D=5 s); la diferencia puede afectar la comparación.

**Objetivo:** observar si la relación de similitud entre A, C y D frente a B se mantiene con **dos ventanas no superpuestas e iguales de 1.5 s** por fragmento. Es una prueba exploratoria del *mismo* WAV público y del *mismo* extractor CAM++; **no constituye una validación independiente**.

## Ventanas fijas (todas de 1,5 s)

| Grupo acústico | Ventana 1 | Ventana 2 | Intervalo de VOICE-01J |
| --- | --- | --- | --- |
| A | A1: 1.0–2.5 | A2: 4.0–5.5 | A: 1–6 |
| B | B1: 14.0–15.5 | B2: 18.5–20.0 | B: 14–20 |
| C | C1: 27.0–28.5 | C2: 28.5–30.0 | C: 27–30 |
| D | D1: 48.0–49.5 | D2: 51.0–52.5 | D: 48–53 |

Cada ventana se extrae de memoria; no hay edición ni escritura del WAV. **No se ha confirmado auditivamente que todas las ventanas contengan voz limpia**. Por eso se registra el RMS dBFS de cada una, como indicador limitado de amplitud (RMS **no** es VAD y no valida contenido hablado). Las ventanas C1 y C2 son adyacentes, sin solaparse.

## Implementación

Script: [`voice01l_stability.py`](voice01l_stability.py).

- Offline CPU con el entorno `%LOCALAPPDATA%\ORBI\LUMIA-VOICE-LAB\.venv`.
- Fija y valida los SHA256 y tamaños de la grabación pública y del ONNX CAM++ de VOICE-01K.
- Genera ocho embeddings **exclusivamente en RAM** por API `SpeakerEmbeddingExtractor` de sherpa-onnx y calcula 4 similitudes intra-grupo (A1–A2, B1–B2, C1–C2, D1–D2).
- Calcula 4 cosenos por cada uno de los 6 pares entre grupos: **24 resultados**, con media/mínimo/máximo sin recortar ni ajustar manualmente resultados.
- Imprime diferencias entre media(A,C) y media(A,B); media(A,D) y media(A,B); además mínimo(A,C)−máximo(A,B) y mínimo(A,D)−máximo(A,B), para detectar si la separación se sostiene en todas las combinaciones.
- Imprime el tiempo total de la extracción y cómputo. Es una medida *offline CPU*, no latencia de LUMIA durante conversación.
- `--doctor` seguro sin inferencia; `--consent` requerido para procesar. Ninguna ruta de carga opcional, micrófono, red, persistencia ni exportación de vectores.

## Ejecución recomendada en ASUS

Cerrar otras pruebas VOICE y ejecutar PowerShell en una sesión normal. La actualización se hace **solo** en el worktree separado y se detiene ante cambios locales sin sobrescribirlos:

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$branch = "feature/lumia-voice01-offline-diarization-lab-20261109"

Push-Location $lab
try {
    if (git status --porcelain) {
        throw "El laboratorio contiene cambios locales; revisar antes de actualizar."
    }
    git fetch origin "refs/heads/${branch}:refs/remotes/origin/${branch}"
    if ($LASTEXITCODE -ne 0) { throw "Git fetch falló" }
    git merge --ff-only "refs/remotes/origin/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Git fast-forward falló" }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $script = Join-Path $lab "labs\voice-01\voice01l_stability.py"
    & $py -B $script --doctor
    if ($LASTEXITCODE -ne 0) { throw "VOICE-01L doctor falló" }
    & $py -B $script --consent
    if ($LASTEXITCODE -ne 0) { throw "VOICE-01L inferencia falló" }
}
finally {
    Pop-Location
}
~~~

Compartir **solo** las dos salidas JSON de PowerShell, no WAV, logs con voces ni embeddings. El resultado tiene `within`, `between`, `comparisons`, `windows` y `elapsed_ms`.

## Interpretación y gates de QA

1. **Primera comprobación:** `mean_ac_minus_ab` y `mean_ad_minus_ab` positivos sugiere que C/D siguen más próximos a A que B, en media. No es probabilidad de identidad.
2. **Prueba de margen conservador:** `worst_ac_minus_best_ab` y `worst_ad_minus_best_ab` positivos significan que incluso el mínimo de las cuatro comparaciones A–C o A–D supera el máximo de A–B. Si son negativos, no desmiente la hipótesis, pero evidencia sensibilidad a las ventanas.
3. **Consistencia interna:** los cosenos A1–A2, B1–B2, C1–C2 y D1–D2 pueden revelar diferencias prosódicas, recortes o momentos no vocales; no suponer que una ventana interna baja significa una persona distinta.
4. **Calidad acústica:** revisar `rms_dbfs` y, si alguno está muy bajo, **escuchar localmente ese fragmento antes de interpretar**. RMS incluye ruido y no verifica voz humana.
5. **Límites:** las 28 parejas son **correlacionadas**, pues comparten solo ocho ventanas de un único archivo. No equivalen a 28 grabaciones independientes, RTTM, DER, tasa de falsos positivos ni calidad del pipeline de diarización real. Tampoco conocemos la coincidencia con embeddings de ventanas internas de sherpa-onnx.

## Estado

- [x] VOICE-01J revisión perceptual C≈A/D≈A.
- [x] VOICE-01K prueba física ASUS con seis cosenos y 1108 ms.
- [x] VOICE-01L script y regresiones sintéticas preparados en rama de laboratorio.
- [x] VOICE-01L CI Windows/Linux: **PASS** del commit `89bc60b1` en run [43146852682](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43146852682), pruebas sintéticas sin inferencia ONNX real.
- [ ] VOICE-01L inferencia real ASUS: pendiente.
- [ ] Corpus humano anotado (incluidos solapamientos) y DER independiente: pendiente.

**Protecciones:** no cambiar clustering, no fusionar `speaker_0`/`speaker_2` automáticamente, no establecer umbrales por intuición. PR #79 en borrador; `main`, modelos personales y LUMIA en vivo intactos.
