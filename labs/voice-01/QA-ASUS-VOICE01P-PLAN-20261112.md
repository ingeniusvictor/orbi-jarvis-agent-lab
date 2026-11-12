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

## Gates

- [x] Lógica de diagnóstico segmentada por actividad de referencia (silencio, 1 voz, superposición).
- [x] Matriz de splits/mixes con soporte mínimo descriptivo y consistencia con el scorer anterior.
- [x] Tests sintéticos de correspondencia, dos reuniones, dos modelos, autorización y sin escritura.
- [ ] CI Windows/Linux en el commit final.
- [ ] QA física ASUS de cuatro inferencias, con resultados reales y desglose.
- [ ] Instrumentación de etapas internas o ablación controlada separada para diferenciar causas.
- [ ] Validación adicional multirreunión / en otros idiomas y DER oficial.

**No publicar esta métrica como DER oficial ni usarla como precisión de LUMIA en producción.**
