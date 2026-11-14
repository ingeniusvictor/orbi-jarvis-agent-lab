# VOICE-01H — QA físico ASUS: holdout con audios nuevos (11-11-2026)

**Resultado: no se demuestra generalización del conteo de hablantes.** Basado en la salida de ocho ejecuciones físicas ASUS sobre los dos WAV públicos NUEVOS y ambos extractores. No se grabó ni subió audio privado.

## Resultados verificables

| Modelo | WAV upstream | Umbral | Esperados por la descripción del WAV | Detectados | Segs. | Tiempo ms | RTF |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ERes2Net | 2-two-speakers-en | 0.50 | 2 | 4 | 9 | 11992 | 0.353 |
| CAM++ | 2-two-speakers-en | 0.50 | 2 | 3 | 9 | 5414 | 0.159 |
| ERes2Net | 2-two-speakers-en | 0.75 | 2 | 4 | 10 | 11641 | 0.342 |
| CAM++ | 2-two-speakers-en | 0.75 | 2 | **2** | 9 | 5465 | 0.161 |
| ERes2Net | 3-two-speakers-en | 0.50 | 2 | 4 | 8 | 21369 | 0.390 |
| CAM++ | 3-two-speakers-en | 0.50 | 2 | 3 | 6 | 9389 | 0.171 |
| ERes2Net | 3-two-speakers-en | 0.75 | 2 | 4 | 8 | 20956 | 0.382 |
| CAM++ | 3-two-speakers-en | 0.75 | 2 | 3 | 6 | 9358 | 0.171 |

CAM++ acertó solo **1/4 conteos** en este holdout (ERes2Net 0/4); los cuatro intentos son dos grabaciones con dos umbrales, **no cuatro muestras independientes**. En VOICE-01G había acertado 5/6 sobre las dos grabaciones usadas para calibración. CAM++ procesó estas dos grabaciones entre 53% y 56% más rápido que ERes2Net en las mismas condiciones, pero **no es una evaluación de latencia de respuesta en vivo**.

SHA256 local 2-two-speakers-en.wav: EE9C33D34E8F0FDA4B78277F609944A1565AA16E6E2146F4CB8F0EFB0D70030B

SHA256 local 3-two-speakers-en.wav: DD3CF2344F8410EE9A2E271E96D1C3F9B530F113AE5B47DEFECBC0D741A468E9

Estos hashes no se compararon con digest oficial: solo validan reproducibilidad local. Tamaños validados por el script contra el GitHub Release: 1 088 078 y 1 753 804 bytes, respectivamente.

## Detalle de segmentos CAM++ (threshold 0.50)

**WAV 2-two-speakers-en**: 9 segmentos, 3 clusters:
- 0.031–2.765 speaker_0
- 2.765–7.810 speaker_1
- 7.844–11.118 speaker_0
- 11.287–13.902 speaker_1
- 13.953–16.923 speaker_0
- 17.159–17.817 speaker_1
- 17.817–18.627 speaker_0
- 18.374–21.142 speaker_1
- 21.142–27.453 speaker_2

**Observación**: los intervalos 17.817–18.627 y 18.374–21.142 se solapan por 0.253 s. Puede ser voz simultánea real o error; el WAV se debe escuchar. speaker_2 aparece entre 21.142 y 27.453; conviene contrastar la voz con los primeros segmentos.

**WAV 3-two-speakers-en**: 6 segmentos, 3 clusters:
- 0.470–8.384 speaker_0
- 8.992–11.641 speaker_0
- 12.620–25.664 speaker_1
- 26.693–30.743 speaker_2
- 31.520–46.336 speaker_1
- 47.534–53.930 speaker_2

El grupo adicional speaker_2 aparece a 26.693–30.743 y 47.534–53.930. Sin anotación humana, no se sabe si pertenece a alguno de los dos hablantes, si hay un tercer hablante o si la separación es errónea.

## Procedencia y límites de referencia

El [README del upstream de sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/blob/master/scripts/pyannote/segmentation/README.md) describe que el audio 2-two-speakers-en procede de un ejemplo de Xenova y que 3-two-speakers-en proviene de una demostración de AWS. No se localizaron RTTM completos en el repositorio upstream revisado. La expectativa de 2 personas procede de la descripción de las muestras, **no** de una anotación independiente de cada turno. Por eso la igualdad del conteo tampoco equivaldría a DER preciso.

## Decisión y nuevo gate VOICE-01I

- CAM++ es el candidato más prometedor por menor latencia CPU y menos grupos espurios que ERes2Net, pero **no está validado** en nuevos archivos; no subir a producción ni cambiar el umbral predeterminado.
- No perseguir más cortes del dendrograma a ciegas: se necesita comprobar si las voces extra corresponden a voces reales, cambios de tono, superposición o errores.
- Se creó un reproductor de fragmentos solo Windows, [voice01_listen.py](voice01_listen.py), que reproduce localmente un rango temporal de WAV PCM16 mono 16 kHz **desde memoria**, sin guardar copias, sin micrófono, sin red y sin dependencias externas. Debe ejecutarse solo sobre archivos propios o públicos permitidos.
- Para cada muestra, escuchar ejemplos de A, B y el cluster extra C; indicar A/B/tercera persona/indeterminado. También revisar el solapamiento 17.8–18.6 segundos en el primer audio.
- Esto es revisión humana orientativa, no un conjunto de referencia RTTM independiente: para evaluar calidad final habrá que anotar también silencios, cambios de turno y solapamientos.

Ejemplo de revisión local después de actualizar el worktree:

~~~powershell
$data = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-VOICE-LAB'
$lab = Join-Path $env:USERPROFILE 'LUMIA-VOICE-LAB'
$py = Join-Path $data '.venv\Scripts\python.exe'
$listener = Join-Path $lab 'labs\voice-01\voice01_listen.py'

& $py -B $listener --wav (Join-Path $data 'samples\2-two-speakers-en.wav') --clip '0.2:2.5' --clip '3.0:6.5' --clip '21.5:26.5' --consent
& $py -B $listener --wav (Join-Path $data 'samples\3-two-speakers-en.wav') --clip '1:6' --clip '14:20' --clip '27:30' --clip '48:53' --consent
~~~

**Pendiente:** VOICE-01I aún no probado físicamente en ASUS. No activar streaming de LUMIA, identificación de personas ni merges a main. Continuidad: PR #79 e Issue #78.
