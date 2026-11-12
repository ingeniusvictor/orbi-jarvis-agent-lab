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
    $top = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($top)) {
        throw "La carpeta no es un repositorio Git valido."
    }
    $expected = (Resolve-Path -LiteralPath $lab).Path
    $actual = (Resolve-Path -LiteralPath $top).Path
    if ($actual -ine $expected) {
        throw "La raiz Git no coincide con el laboratorio aislado."
    }
    $changes = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $changes.Count -gt 0) {
        throw "Hay cambios locales o fallo de Git: revisar antes de actualizar."
    }

    # Compatible con worktrees en detached HEAD: no fuerza cambio de rama.
    git fetch origin "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Git fetch fallo" }
    git merge-base --is-ancestor HEAD FETCH_HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "El HEAD actual no es antecesor de la rama remota; no se actualizo."
    }
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "Git fast-forward fallo" }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $script = Join-Path $lab "labs\voice-01\voice01l_stability.py"
    & $py -B $script --doctor
    if ($LASTEXITCODE -ne 0) { throw "VOICE-01L doctor fallo" }
    & $py -B $script --consent
    if ($LASTEXITCODE -ne 0) { throw "VOICE-01L inferencia fallo" }
}
finally {
    Pop-Location
}
~~~

Compartir **solo** las dos salidas JSON de PowerShell, no WAV, logs con voces ni embeddings. El resultado tiene `within`, `between`, `comparisons`, `windows` y `elapsed_ms`.

**Nota de compatibilidad Git:** la ASUS devolvió un error PowerShell cuando el comando de una respuesta previa intentó llamar a `.Trim()` sobre la salida vacía de `git branch --show-current`. En worktrees con `HEAD` desacoplado la salida vacía es válida; no usar esa comprobación ni obligar a `git switch`. El comando actualizado verifica la raíz del repositorio, exige el árbol limpio, descarga el commit remoto a `FETCH_HEAD`, comprueba ascendencia y hace solo `git merge --ff-only`. No se conoció aún el estado exacto del HEAD local; si no es un avance lineal, el procedimiento se detiene sin cambiar el repositorio.

## Interpretación y gates de QA

1. **Primera comprobación:** `mean_ac_minus_ab` y `mean_ad_minus_ab` positivos sugiere que C/D siguen más próximos a A que B, en media. No es probabilidad de identidad.
2. **Prueba de margen conservador:** `worst_ac_minus_best_ab` y `worst_ad_minus_best_ab` positivos significan que incluso el mínimo de las cuatro comparaciones A–C o A–D supera el máximo de A–B. Si son negativos, no desmiente la hipótesis, pero evidencia sensibilidad a las ventanas.
3. **Consistencia interna:** los cosenos A1–A2, B1–B2, C1–C2 y D1–D2 pueden revelar diferencias prosódicas, recortes o momentos no vocales; no suponer que una ventana interna baja significa una persona distinta.
4. **Calidad acústica:** revisar `rms_dbfs` y, si alguno está muy bajo, **escuchar localmente ese fragmento antes de interpretar**. RMS incluye ruido y no verifica voz humana.
5. **Límites:** las 28 parejas son **correlacionadas**, pues comparten solo ocho ventanas de un único archivo. No equivalen a 28 grabaciones independientes, RTTM, DER, tasa de falsos positivos ni calidad del pipeline de diarización real. Tampoco conocemos la coincidencia con embeddings de ventanas internas de sherpa-onnx.

## QA física ASUS — VOICE-01L (12-11-2026)

La ASUS reportó **fast-forward** de `e4dae8a..c269d7a`; `--doctor` confirmó ocho ventanas de 1,5 s, `sherpa_installed=true`, sin micrófono/red/escrituras. El resultado de `--consent` fue **`ok=true`**, WAV público `3-two-speakers-en.wav`, modelo `CAM++`, 8 ventanas, inferencia y análisis offline `elapsed_ms=764`.

### Similitudes internas de los dos cortes por grupo

| Grupo | Coseno ventana 1 frente a 2 |
| --- | ---: |
| A | 0.54320 |
| B | 0.67449 |
| C | 0.66596 |
| D | 0.61389 |

### Similitudes cruzadas entre grupos (cuatro pares de ventanas por fila)

| Par | Media | Mínimo | Máximo |
| --- | ---: | ---: | ---: |
| A-B | 0.26279 | 0.19604 | 0.34369 |
| A-C | 0.54355 | 0.41611 | 0.62491 |
| A-D | 0.57764 | 0.45578 | 0.66868 |
| B-C | 0.33542 | 0.21837 | 0.43670 |
| B-D | 0.32289 | 0.22324 | 0.40535 |
| C-D | 0.67429 | 0.57266 | 0.81855 |

Comparaciones reportadas por el script:
- `mean_ac_minus_ab = +0.28075`
- `mean_ad_minus_ab = +0.31485`
- `worst_ac_minus_best_ab = +0.07242`
- `worst_ad_minus_best_ab = +0.11209`

Los dos márgenes mínimos son positivos: **todas las cuatro combinaciones A-C y todas las cuatro A-D superan el máximo A-B**. Esto reproduce el orden de VOICE-01K con ventanas iguales, aunque los valores absolutos de los cosenos descienden. Se observa variabilidad notable en A (A1-A2=0.54320), por lo que el resultado **no justifica asumir un modelo de voz estático ni fusionar clusters automáticamente**.

### Niveles RMS de las ocho ventanas

| Ventana | Segundos | RMS dBFS |
| --- | --- | ---: |
| A1 | 1.0–2.5 | -26.84 |
| A2 | 4.0–5.5 | -28.40 |
| B1 | 14.0–15.5 | -21.10 |
| B2 | 18.5–20.0 | -28.03 |
| C1 | 27.0–28.5 | -27.10 |
| C2 | 28.5–30.0 | -22.81 |
| D1 | 48.0–49.5 | -29.66 |
| D2 | 51.0–52.5 | -25.22 |

No se detecta un RMS cercano a silencio digital absoluto, **pero RMS no confirma voz presente ni calidad del recorte**. El propio resultado reporta `windows_audibly_checked=false`. Validación auditiva individual aún pendiente.

El JSON confirmó: `exploratory_only=true`, `equivalent_to_diarizer_internal=false`, `speaker_identity_verified=false`, `der_validated=false`, `embedding_vectors_exported=false`, `files_written=0`, `microphone_enabled=false`, `network_enabled=false`. **Ningún embedding, voz o WAV personal se almacenó en el repositorio.**

**Conclusión acotada:** el agrupamiento del VOICE-01H sigue siendo sospechoso de sobrefragmentación (`speaker_0` A vs `speaker_2` C/D), con evidencia consistente de similitud en este **único** WAV; no se han validado identidades de personas, dos hablantes reales ni DER. Estos 28 cosenos son pares correlacionados provenientes de solo ocho ventanas, no 28 muestras independientes. Los cosenos de clips no son necesariamente los vectores ni la métrica de clustering interna del diarizador, y 764 ms no es latencia de voz en vivo.

**Próximo gate propuesto:** confirmar mediante escucha local que las ocho ventanas contienen voz limpia y trabajar con al menos una grabación **independiente con referencia temporal anotada**, sin ajustar threshold ni cambiar LUMIA en vivo.

## VOICE-01L — reproducción física de las ocho ventanas (12-11-2026)

El propietario ejecutó en la ASUS `voice01_listen.py` (VOICE-01I) sobre el WAV público `3-two-speakers-en.wav` con ocho recortes `--clip` en el orden A1/A2/B1/B2/C1/C2/D1/D2:
`1:2.5`, `4:5.5`, `14:15.5`, `18.5:20`, `27:28.5`, `28.5:30`, `48:49.5`, `51:52.5`.

La salida fue **`ok=true`, `clips_played=8`, `files_written=0`, `microphone_enabled=false`, `identity_confirmed=false`**. Esto confirma ejecución del reproductor local sobre ocho recortes, pero **no certifica que cada uno contenga voz clara** ni aporta una evaluación perceptual de A1–D2. La escucha humana individual continúa sin documentarse: solicitar del operador para cada ventana `voz clara` / `ruido-pausa` / `incierto`. No tratar el éxito de `PlaySound` como una anotación VAD humana, ni declarar DER o identidad verificada. No subir WAV ni audio personal a GitHub.

## Estado

- [x] VOICE-01J revisión perceptual C≈A/D≈A.
- [x] VOICE-01K prueba física ASUS con seis cosenos y 1108 ms.
- [x] VOICE-01L script y regresiones sintéticas preparados en rama de laboratorio.
- [x] VOICE-01L CI Windows/Linux: **PASS** del commit `89bc60b1` en run [43146852682](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43146852682), pruebas sintéticas sin inferencia ONNX real.
- [x] VOICE-01L inferencia real ASUS: **PASS de ejecución**, 764 ms, 28 cosenos y márgenes positivos documentados; no implica DER.
- [x] Reproducción física de los ocho recortes con VOICE-01I: `ok=true` y 8/8 ejecutados.
- [ ] Clasificación perceptual individual (voz clara / ruido-pausa / incierto) de las ocho ventanas: pendiente.
- [ ] Corpus humano anotado (incluidos solapamientos) y DER independiente: pendiente.

**Protecciones:** no cambiar clustering, no fusionar `speaker_0`/`speaker_2` automáticamente, no establecer umbrales por intuición. PR #79 en borrador; `main`, modelos personales y LUMIA en vivo intactos.
