# VOICE-01K — similitud acústica controlada de Audio 3 (plan y gate ASUS)

**Motivo:** en VOICE-01J, el propietario comparó por oído **C≈A y D≈A** del WAV público `3-two-speakers-en.wav`. En la diarización CAM++ de VOICE-01H a threshold 0.50, A fue `speaker_0`, B `speaker_1`, y C/D `speaker_2`. **Hipótesis:** un mismo hablante pudo quedar dividido en dos clusters (sobrefragmentación); sigue sin demostrarse quién habla.

## Preparación implementada

Script opt-in [`voice01k_similarity.py`](voice01k_similarity.py), en el laboratorio aislado. Usa **solo** el WAV público existente, con tamaño y SHA256 previamente observados en ASUS, y la copia local CAM++ con SHA256 contrastado con el mantenedor. No descarga ni instala modelos; usa `sherpa-onnx` y `numpy` ya disponibles en el venv privado.

Clips fijos: A 1–6 s, B 14–20 s, C 27–30 s, D 48–53 s. Extrae cuatro embeddings temporales por API pública de `SpeakerEmbeddingExtractor`; computa **únicamente seis similitudes coseno** (A-B, A-C, A-D, B-C, B-D, C-D); imprime JSON en consola, sin vectores crudos ni audio, sin tocar disco, sin micrófono/red ni perfiles humanos. Incluye `--doctor` y requiere `--consent` para inferencia.

API de referencia (no copia integral):
https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/speaker-identification.py
En este experimento **no** usamos la función de grabación/micrófono del ejemplo upstream.

## Ejecutar en ASUS (solo voluntariamente)

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$branch = "feature/lumia-voice01-offline-diarization-lab-20261109"

Push-Location $lab
try {
    if (git status --porcelain) { throw "Hay cambios locales: revisar antes de actualizar" }
    git fetch origin "refs/heads/${branch}:refs/remotes/origin/${branch}"
    if ($LASTEXITCODE -ne 0) { throw "Error en git fetch" }
    git merge --ff-only "refs/remotes/origin/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Error en fast-forward" }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $probe = Join-Path $lab "labs\voice-01\voice01k_similarity.py"
    & $py -B $probe --doctor
    if ($LASTEXITCODE -ne 0) { throw "Fallo doctor" }

    & $py -B $probe --consent
    if ($LASTEXITCODE -ne 0) { throw "Fallo VOICE-01K; comparte solo el error de consola" }
}
finally {
    Pop-Location
}
~~~

## Interpretación prevista (sin forzar conclusiones)

- Si A-C y A-D dan cosenos mayores que A-B, es una señal **compatible** con la impresión auditiva del propietario, **no una prueba de mismo hablante**.
- Si A-C/A-D salen bajos respecto a A-B, investigar contenido, ruido, cortes y estabilidad de CAM++, sin desautorizar automáticamente la audición humana.
- C-D sirve como control interno de los dos segmentos asignados al mismo cluster `speaker_2`.
- Un coseno de clip completo **no coincide necesariamente con el embedding exacto usado por el pipeline de diarización** (segmentación, ventanas, normalización y agregación pueden diferir). No usar este experimento para calcular DER, calibrar automáticamente threshold ni fusionar clusters; cada resultado será evidencia exploratoria.
- La semejanza acústica no autentica personas reales, ni sustituye verificar el destinatario de los comandos de LUMIA.

## Estado de gates

- [x] VOICE-01J: Audio 3 C≈A y D≈A documentado, resultados subjetivos.
- [x] Script VOICE-01K preparado en rama experimental, sin modificaciones al producto.
- [ ] CI Windows/Linux en el commit final — comprobar antes de reportar PASS.
- [ ] Ejecución física ASUS — **pendiente**; no inventar puntuaciones coseno.
- [ ] Referencia independiente RTTM/DER y escenarios físicos multihablante — pendiente.

**Restricciones:** PR #79 en borrador, `main` y `src/lib/voice.ts` intactos, nada de sonido privado ni embeddings en GitHub.
