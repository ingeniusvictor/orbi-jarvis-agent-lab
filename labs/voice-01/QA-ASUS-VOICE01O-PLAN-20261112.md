# VOICE-01O — Segunda reunion AMI con referencia independiente

Fecha: 2026-11-12. Rama: feature/lumia-voice01-offline-diarization-lab-20261109. PR #79 draft.

## Hipotesis y contexto

VOICE-01M/N: AMI ES2002a, segundos 60-160, cuatro hablantes manuales,
ocho grupos automaticos para ambos extractores (CAM++/ERes2Net), errores
experimentales sin collar de 13.726% y 16.733%.

La matriz VOICE-01N mostro:
- p1 distribuido entre 2 grupos significativos con CAM++ y 3 con ERes2Net.
- p0, p2, p3 asociados mayoritariamente con un solo grupo cada uno.
- speaker_7 con soporte 0 en la matriz no ambigua, pero presente
  en regiones con actividad/superposicion, por lo cual no debe
  considerarse necesariamente ruido ni atribuirse a otra persona.

**Objetivo:** comprobar si el exceso de grupos, la division de hablantes
y el error tipo DER se reproducen con otro grupo de personas en una reunion
independiente y sin ajustar el umbral ni forzar conteo de hablantes.

## Segunda muestra preseleccionada

AMI ES2003a, 10.0 a 110.0 s (100 s), audio publico Mix-Headset,
referencia RTTM de anotaciones manuales only_words:
- Audio oficial: https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/HeadsetAudio/ES2003a.Mix-Headset.wav
- Referencia: https://github.com/pyannote/AMI-diarization-setup/blob/main/only_words/rttms/train/ES2003a.rttm
- Licencia: AMI Meeting Corpus CC BY 4.0, con atribucion.

Es otro conjunto de voces (IDs manuales MEE009, MEE010, MEE011, MEE012
en la referencia original), distinto de ES2002a. El programa anonimiza
estos identificadores localmente como p0-p3 y nunca imprime los originales.

**La seleccion del clip se hizo antes de observar predicciones.**
La presencia de cuatro IDs en el recorte se comprobara por el preparador.

## Flujo

Archivo de codigo: voice01o_second_meeting.py

- --doctor: revisa si el benchmark preparado ya existe; sin red,
  modelos ni escritura.
- --prepare --consent: descarga voluntaria de audio publico y anotaciones
  manuales, limita el tamaño de descarga, recorta exactamente 100 s,
  renombra IDs y guarda solamente WAV recortado, RTTM anonimo y manifiesto
  con hashes SHA256 en %LOCALAPPDATA%/ORBI/LUMIA-VOICE-LAB/benchmarks/voice01o_ami.
  El audio original completo se procesa en RAM sin persistirse a disco.
- --run --compare --consent: evalua CAM++ y ERes2Net offline,
  conteo automatico de grupos y threshold congelado en 0.50.
  Comprueba SHA256 de WAV, RTTM y peso CAM++ antes de inferir;
  reutiliza el segmentador ONNX local y el mismo evaluador de VOICE-01M,
  asi como resumen anonimo de fragmentacion de VOICE-01N.
- Salida: solo JSON agregado con conteos, porcentajes tipo DER experimental,
  omisiones, falsas alarmas, confusion, duracion de CPU y grupos por cada
  hablante anonimizado. No escribe vectores, audio ni predicciones en archivos.
- La puntuacion NO es DER oficial y no valida reconocimiento personal, ni
  calidad general de LUMIA en español/hogar/voz simultanea.

Si la fuente publica no responde, cambió de formato o su referencia
no contiene exactamente cuatro voces, la ejecucion se detiene sin
inventar datos, sin cambiar la muestra y sin alterar LUMIA.

## PowerShell ASUS (solo laboratorio aislado)

No ejecutar en la carpeta LUMIA productiva. Este script contempla
HEAD desacoplado y detiene cualquier cambio local sin sobrescribir.

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$branch = "feature/lumia-voice01-offline-diarization-lab-20261109"

Push-Location $lab
try {
    $root = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw "No se identifico el repositorio."
    }
    if ((Resolve-Path -LiteralPath $root).Path -ine
        (Resolve-Path -LiteralPath $lab).Path) {
        throw "La raiz Git no corresponde al laboratorio."
    }

    $dirty = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) {
        throw "Hay cambios locales; revisar antes de actualizar."
    }

    git fetch origin "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { throw "Git fetch fallo." }

    git merge-base --is-ancestor HEAD FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "No es fast-forward seguro." }

    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "Git merge fallo." }

    $py = Join-Path $data ".venv\Scripts\python.exe"
    $file = Join-Path $lab "labs\voice-01\voice01o_second_meeting.py"

    & $py -B $file --doctor --compare
    if ($LASTEXITCODE -ne 0) { throw "Doctor fallo." }

    # Solo la primera vez: HTTPS para obtener AMI ES2003a publico.
    & $py -B $file --prepare --consent
    if ($LASTEXITCODE -ne 0) { throw "Preparacion fallo." }

    # No hay red durante la inferencia: datos publicos locales.
    & $py -B $file --run --compare --consent
    if ($LASTEXITCODE -ne 0) { throw "Evaluacion fallo." }
}
finally {
    Pop-Location
}
~~~

Si ES2003a ya esta preparado, omitir --prepare: no sobrescribe datos.
Compartir solo salidas JSON de PowerShell. El clip no altera ES2002a.

## Gates

- [x] Audio ES2003a presente en indice oficial y RTTM externo manual con 4 voces distintas.
- [x] Script aislado con permisos y almacenamiento separado.
- [x] Pruebas unitarias sin red con validacion de SHA, anonimato y evaluacion dual.
- [x] CI Windows/Linux: **45/45 PASS en ambos SO**, run https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43154141986, commit e07aa825 (solo tests sinteticos; NO inferencia AMI ES2003a fisica).
- [ ] Descarga/preparacion fisica en ASUS.
- [ ] Evaluacion CAM++/ERes2Net en ASUS y comparacion con ES2002a.
- [ ] Tercera muestra / DER oficial / validacion de otras condiciones.

No fusionar PR, no ajustar umbrales ni modificar LUMIA live.
