# LUMIA VOICE-01N — matriz temporal para investigar la sobrefragmentación

Fecha: 12-11-2026. Rama aislada: `feature/lumia-voice01-offline-diarization-lab-20261109`. PR #79 en borrador.

## Antecedentes físicos confirmados

En AMI `ES2002a`, clip **60–160 s**, VOICE-01M mostró 4 voces de referencia (`p0`–`p3`) frente a **8 grupos automáticos** de CAM++ y 8 de ERes2Net, ambos con clustering automático `num_speakers=-1` y `threshold=0.50`.

- CAM++: 18 segmentos, error tipo DER **13.726 %**, 15 607 ms CPU.
- ERes2Net: 15 segmentos, error tipo DER **16.733 %**, 38 401 ms CPU.
- Referencia: 96.56 segundos-hablante, 4.73 segundos de solapamiento (wall clock), 18 turnos anotados.
- La métrica es experimental (sin collar/UEM) y no equivale a DER oficial. 8 IDs no demuestran por sí solos que cuatro voces se hayan dividido exactamente en dos.

## Objetivo VOICE-01N

El script [`voice01n_reference_matrix.py`](voice01n_reference_matrix.py) vuelve a ejecutar **exactamente** el mismo pipeline y modelos del VOICE-01M. No puede reconstruirse la matriz desde sus porcentajes anteriores: las asignaciones temporales originales no se exportaron por protección de privacidad. Se vuelve a hacer inferencia local en la ASUS y se computa la matriz **solo en memoria**.

La matriz principal `nonoverlap_matrix` contiene, en **segundos**, la coincidencia entre cada persona etiquetada `p0`–`p3` y cada grupo automático `speaker_N`, contando **únicamente los intervalos en los que hay exactamente una voz manual y exactamente un grupo predicho**. Esto evita atribuirle una persona arbitraria a un intervalo con varias voces activas.

El resultado también contiene:

1. `coactive_matrix`: intersección temporal de **todas** las etiquetas activas, incluidas voces superpuestas. Sus filas/columnas no se suman como segundos reales de reloj (puede contar múltiples voces por segundo).
2. `reference_split_diagnostics`: cuántos grupos predichos tienen evidencia temporal con cada voz manual, su máximo contribuyente y el porcentaje de concentración del grupo dominante.
3. `predicted_group_details`: duración de cada grupo y segundos fuera del RTTM manual (que **no** equivalen necesariamente a falsos positivos, porque la referencia AMI `only_words` no etiqueta todas las vocalizaciones).
4. `der_like_error_percent`: recalculado como control de regresión con VOICE-01M; no es DER oficial.
5. `groups_with_at_least_1_second`: criterio **descriptivo**, fijado antes del resultado, no umbral para fusionar voces ni para ajustar clustering.

Interpretación correcta: una referencia con varios grupos de contribución significativa es evidencia específica de posible fragmentación; un grupo automático que coincide con varias referencias puede reflejar confusión; un grupo con muy poca coincidencia o ubicado fuera del RTTM puede corresponder a ruidos, habla no etiquetada o desajustes temporales. Las decisiones requieren audición/documentación adicional y más muestras independientes.

## Seguridad y límites

- Lee únicamente los archivos preparados previamente en `%LOCALAPPDATA%\ORBI\LUMIA-VOICE-LAB\benchmarks\voice01m_ami` y validados por SHA256.
- No vuelve a descargar ningún archivo, no requiere internet, no usa micrófono, no crea WAV/RTTM/predicciones/embeddings ni cambia los pesos ONNX.
- Solo imprime JSON agregado con etiquetas **anónimas**; no expone nombres, transcripciones ni cronología de turnos individuales.
- No modifica el conteo de hablantes automático (`num_speakers=-1`) ni `cluster_threshold=0.50`.
- Matriz válida únicamente para un fragmento público; no justifica cambios automáticos en LUMIA de producción ni generalización a español, niños o conversaciones del hogar.

## PowerShell ASUS — solo actualizar + analizar, sin preparar de nuevo

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$branch = "feature/lumia-voice01-offline-diarization-lab-20261109"

Push-Location $lab
try {
    $top = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($top)) {
        throw "Git no identifica esta carpeta como repositorio."
    }
    $expected = (Resolve-Path -LiteralPath $lab).Path
    $actual = (Resolve-Path -LiteralPath $top).Path
    if ($actual -ine $expected) {
        throw "La raiz Git no es el laboratorio aislado."
    }
    $changes = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $changes.Count -gt 0) {
        throw "Cambios locales pendientes; no sobrescribir."
    }
    git fetch origin "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Error en git fetch." }
    git merge-base --is-ancestor HEAD FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "No es un fast-forward seguro." }
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "Error al actualizar." }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $script = Join-Path $lab "labs\voice-01\voice01n_reference_matrix.py"

    & $py -B $script --doctor --compare
    if ($LASTEXITCODE -ne 0) { throw "Doctor VOICE-01N fallo." }

    & $py -B $script --run --compare --consent
    if ($LASTEXITCODE -ne 0) { throw "Inferencia VOICE-01N fallo." }
}
finally {
    Pop-Location
}
~~~

**No ejecutar `--prepare`**: el corpus y su referencia ya existen en ASUS. Publicar en este hilo exclusivamente el JSON de salida (sin audios ni archivos de referencia).

## Gates

- [x] Matriz temporal anónima, con discriminación de solapamiento / no solapamiento, programada en la rama de laboratorio.
- [x] Tests sintéticos de matriz, superposición, no referencia, 6+ grupos, consentimiento y contrato de modelos.
- [ ] CI Windows/Linux sobre el commit final.
- [ ] QA físico ASUS con CAM++ y ERes2Net (mismos pesos/umbral).
- [ ] Evaluación de hipótesis con otra reunión independiente.
- [ ] DER oficial o validación humana de confusiones reales (sin datos sensibles).

El PR #79 sigue en borrador y `main`/LUMIA live siguen intactos.
