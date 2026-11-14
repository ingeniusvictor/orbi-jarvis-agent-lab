# LUMIA VOICE-01P — Anatomía de errores sin cambios al diarizador

Fecha: 12-11-2026. Rama independiente `feature/lumia-voice01-offline-diarization-lab-20261109`. PR #79 sigue en borrador. No modificar main ni runtime de LUMIA.

## Evidencia física anterior, sin extrapolar

Las fases VOICE-01M/N/O se ejecutaron en ASUS con dos reuniones distintas AMI, extractos de 100 s, anotaciones manuales externas `only_words` y el mismo umbral de agrupamiento 0.50:

| Reunión | Referencia manual | CAM++: grupos / error tipo DER | ERes2Net: grupos / error tipo DER |
| --- | --- | --- | --- |
| ES2002a (60–160 s) | 4 voces, 18 turnos | 8 / 13.726% | 8 / 16.733% |
| ES2003a (10–110 s) | 4 voces, 20 turnos | 4 / 29.118% | 5 / 33.213% |

Son medidas **similares a DER pero NO oficiales** (sin collar ni protocolo UEM). La primera reunión mostró fragmentación significativa de p1 (dos grupos CAM++, tres ERes2Net). La segunda mostró fragmentación de p0 (tres grupos CAM++, cuatro ERes2Net) y mezcla entre etiquetas de referencia; CAM++ detectó 4 grupos pero cometió 29.118% de error experimental.

## Qué responde VOICE-01P

El programa `voice01p_error_attribution.py` compara los segmentos temporales **finales** de cada modelo contra el RTTM manual, sin guardar predicciones individuales. Distingue tres contextos de referencia:

1. **Silencio en la referencia:** segundos en los que no existe hablante anotado. Ayuda a estudiar predicciones fuera de `only_words`, que pueden incluir habla no etiquetada y NO son automáticamente ruido.
2. **Una sola voz de referencia:** permite ver si el modelo omitió actividad, generó actividad adicional o asignó a un grupo inconsistente.
3. **Dos o más voces simultáneas de referencia:** cuenta déficit o exceso de hablantes activos y compara cuántos grupos emitió el modelo mientras había solapamiento.

En cada contexto descompone la métrica experimental en **MISS**, **FA** y **confusión** expresados en segundos-hablante; usa la misma asignación uno-a-uno óptima y sin collar que VOICE-01M y verifica que el total coincide con su scorer. La comparación usa **puntos de inicio/fin exactos**, no redondeo a tramas.

Además calcula:
- `split_candidates`: referencia manual con 2+ grupos automáticos que tienen **al menos 1.0 s de coincidencia no ambigua** cada uno.
- `mixed_predicted_groups`: grupo automático asociado con 2+ voces manuales distintas con **al menos 1.0 s de soporte no ambiguo** cada una.
- `groups_without_unambiguous_support`: grupo con duración >=1.0 s y 0 s de soporte 1:1 (podría estar en solapamiento, en zona ambigua o por problemas de segmentación/RTTM).

El criterio de **1 s es solo descriptivo**, fijado previamente para filtrar coincidencias triviales, **NO** ajusta el clustering ni decide fusiones. Los IDs de referencia y predicción son anónimos, y no se recuperan identidades de personas.

### Límites críticos

El programa no instrumenta directamente las salidas intermedias del segmentador, sus probabilidades, ni las ventanas internas del extractor. Por tanto, estos resultados **NO prueban causalmente** que un error sea producido por la etapa de segmentación o por la de clustering, aunque permiten localizar el tipo de error observable y orientar una ablación posterior. Un score se obtiene frente a un RTTM `only_words` que omite algunas vocalizaciones. No introducir ajustes automáticos a umbrales ni cambiar a conteo forzado porque el número de grupos coincida en ES2003a.

## Seguridad

- `--doctor`: verifica **presencia** de AMI ES2002a/ES2003a bajo LOCALAPPDATA, sin red, micrófono, escritura ni inferencia.
- `--run --compare --consent`: carga **solo los dos clips ya preparados** y sus RTTM mediante validación SHA256, reutiliza los modelos locales CAM++ y ERes2Net, ejecuta 4 inferencias CPU en total. No descarga, crea archivos, imprime texto reconocido, grabaciones, nombres, vectores ni cronología de turnos.
- Se conserva `num_speakers=-1` y `cluster_threshold=0.50`.
- El cálculo permanece en RAM y emite exclusivamente JSON agregado; los parámetros de producción no se modifican.

## PowerShell completo para ASUS

Compatible con worktree Git de HEAD desacoplado. Se detiene si detecta cambios locales, si falta cualquiera de los archivos preparados o si no puede avanzar mediante fast-forward. **No ejecutar --prepare**: ambos corpus ya existen localmente.

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$branch = "feature/lumia-voice01-offline-diarization-lab-20261109"

Push-Location $lab
try {
    $root = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw "No se identifico el laboratorio Git."
    }
    $expected = (Resolve-Path -LiteralPath $lab).Path
    $actual = (Resolve-Path -LiteralPath $root).Path
    if ($actual -ine $expected) {
        throw "No estamos en el worktree aislado."
    }
    $changes = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $changes.Count -gt 0) {
        throw "Cambios locales pendientes, revisar antes de actualizar."
    }

    git fetch origin "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Git fetch fallo." }
    git merge-base --is-ancestor HEAD FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "No es un fast-forward seguro." }
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "Git merge fallo." }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $file = Join-Path $lab "labs\voice-01\voice01p_error_attribution.py"

    & $py -B $file --doctor
    if ($LASTEXITCODE -ne 0) { throw "Doctor VOICE-01P fallo." }

    & $py -B $file --run --compare --meeting both --consent
    if ($LASTEXITCODE -ne 0) { throw "Analisis VOICE-01P fallo." }
}
finally {
    Pop-Location
}
~~~

Si necesitas aislar una reunión por diagnóstico, las opciones son `--meeting ES2002a` y `--meeting ES2003a`; por defecto se evalúan ambas. Comparte solo los resultados JSON por PowerShell, no WAV ni RTTM.

## QA física ASUS — VOICE-01P (12-11-2026)

**Salida real aportada por el usuario desde ASUS:** worktree actualizado por fast-forward `f385d27..5dff559`; `--doctor` verificó `ES2002a=true` y `ES2003a=true` sin red ni escritura. `--run --compare --meeting both --consent` devolvió `ok=true`, cuatro inferencias y `scorer_consistency_verified=true` en cada comparación. Umbral original `0.5`, número de hablantes automático/no forzado; cero nuevas descargas, escritura, micrófono, red, exportación de audio, turnos o embeddings.

### Resultados reproducidos y anatomía por región

| Reunión / modelo | Clusters frente a 4 referencias | Segmentos | CPU (ms) | Error tipo DER no oficial | MISS s-h | FA s-h | CONF s-h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ES2002a CAM++ | 8 | 18 | 15765 | 13.726% | 5.220 | 1.389 | 6.645 |
| ES2002a ERes2Net | 8 | 15 | 37149 | 16.733% | 5.511 | 1.528 | 9.118 |
| ES2003a CAM++ | **4** | 10 | 15958 | **29.118%** | 2.202 | 2.626 | 17.794 |
| ES2003a ERes2Net | 5 | 10 | 35819 | 33.213% | 2.220 | 2.626 | 20.957 |

Referencia ES2002a: 96.56 speaker-s, **4.73 s** de solapamiento y 9.14 s de silencio según RTTM `only_words`. Referencia ES2003a: 77.69 speaker-s, **2.43 s** de solapamiento y 24.74 s de silencio RTTM. Valores de `silence` son ausencia de anotación, **no prueba de silencio acústico real**.

| Contexto y métrica | ES2002a CAM++ | ES2002a ERes2Net | ES2003a CAM++ | ES2003a ERes2Net |
| --- | ---: | ---: | ---: | ---: |
| Silencio ref.: FA speaker-s | 0.625 | 0.682 | **2.613** | **2.613** |
| Voz única ref.: MISS speaker-s | 2.604 | 2.543 | 1.463 | 1.413 |
| Voz única ref.: FA speaker-s | 0.750 | 0.846 | 0.013 | 0.013 |
| Voz única ref.: **confusión speaker-s** | **4.841** | 5.275 | **17.794** | **19.137** |
| Overlap ref.: MISS speaker-s | 2.616 | 2.968 | 0.739 | 0.807 |
| Overlap ref.: FA speaker-s | 0.014 | 0 | 0 | 0 |
| Overlap ref.: confusión speaker-s | 1.804 | 3.843 | **0** | 1.820 |
| Overlap ref.: solo 1 grupo predicho (wallclock s) | 2.189 | 1.998 | 0.739 | 0.807 |
| Overlap ref.: >=2 grupos predichos (wallclock s) | 2.541 | 2.732 | 1.691 | 1.623 |

**Conclusiones acotadas:**

- ES2003a CAM++ presenta **17.794 / 22.622 = 78.66%** del error total en **confusión durante voz única**, no en actividad simultánea. ERes2Net tiene **19.137 / 25.803 = 74.17%** en la misma categoría. La prioridad para esta reunión es comprender el intercambio/mezcla de grupos en condiciones sin solapamiento.
- ES2002a presenta una debilidad adicional durante **overlap**: CAM++ tiene 2.616 speaker-s de MISS sobrelapados y deja un único grupo predicho durante 2.189 de los 4.73 s de simultaneidad; ERes2Net 2.968 speaker-s de MISS y un único grupo durante 1.998 s. No diagnostica directamente el mecanismo del segmentador.
- **Splits descriptivos >=1 s no ambiguos:** ES2002a `p1`: 2 grupos CAM++ (`speaker_1` 4.383 s, `speaker_6` 4.544 s), 3 ERes2Net (`speaker_1` 3.212, `speaker_5` 3.989, `speaker_6` 1.570). ES2003a `p0`: 3 CAM++ (43.542, 11.180, 5.526 s), 4 ERes2Net (42.262, 10.454, 6.318, 1.280 s); `p1` dividida en 2 grupos de >=1 s para ambos modelos.
- **Mezclas descriptivas >=1 s por referencia:** ES2002a sin clusters que superen dicho criterio; ES2003a CAM++ `speaker_0` tiene soporte `p0=11.180` y `p3=6.713` segundos; `speaker_2` tiene `p0=5.526`, `p1=1.020`, `p2=1.390`. ERes2Net exhibe dos mezclas análogas. Tener **4 de 4 grupos** no indica atribución correcta.
- ES2002a `speaker_7` sigue sin coincidencia **no ambigua** (1.165 s CAM++; 2.532 s ERes2Net de duración total), pero la presencia ocurre en contexto anotado; no asignar identidad ni clasificar automáticamente como ruido.
- La consistencia `scorer_consistency_verified=true` verifica la aritmética agregada frente al **mismo scorer experimental**; no constituye una validación de DER oficial o de corrección de los anotadores.

**Siguiente gate experimental sugerido: VOICE-01Q**, instrumentar la frontera entre segmentación y embeddings/clustering de manera **solo diagnóstica**: documentar segmentos candidatos antes del clustering, duración/cobertura y detección de overlap, sin guardar audio privado ni vectores de voz. Diseñar después ablaciones separadas y predefinidas; no adaptar el umbral 0.50 en vivo ni fusionar grupos. Los resultados finales de estos 2 clips **no prueban causalidad de una etapa interna** y no generalizan a conversaciones domésticas.

## Gates

- [x] Lógica de diagnóstico segmentada por actividad de referencia (silencio, 1 voz, superposición).
- [x] Matriz de splits/mixes con soporte mínimo descriptivo y consistencia con el scorer anterior.
- [x] Tests sintéticos de correspondencia, dos reuniones, dos modelos, autorización y sin escritura.
- [x] CI Windows y Ubuntu: **53/53 PASS en cada SO** para el commit fe9a854 (8 pruebas nuevas de VOICE-01P), run https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43155567047. Son pruebas sintéticas; no se ha ejecutado físicamente VOICE-01P en la ASUS.
- [x] QA física ASUS **PASS**: cuatro inferencias sobre ambos corpus, scorer consistente, desglose por contexto y riesgos de split/mix documentados.
- [ ] Instrumentación de etapas internas o ablación controlada separada para diferenciar causas.
- [ ] Validación adicional multirreunión / en otros idiomas y DER oficial.

**No publicar esta métrica como DER oficial ni usarla como precisión de LUMIA en producción.**
