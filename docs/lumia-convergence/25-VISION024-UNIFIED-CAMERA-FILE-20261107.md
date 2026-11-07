# LUMIA VISION-02.4 — Cámara y archivos en un solo visor

## Continuidad (ASUS, 7 noviembre 2026)

Base: VISION-02.3.1, commit `0c6826d1af`, PR #53. Rama de trabajo VISION-02.4; `main` intacta.

## Qué resuelve

Antes, `LumiaCameraViewfinder` solo podía capturar desde webcam; el adjunto VI-01 era una ruta independiente, sin el visor y sin el diálogo visual contextual. Esto obligó a fotografiar un retrato con reflejos para probar la conversación.

Ahora el visor contiene las pestañas **Cámara web** y **Cargar imagen**.

- Cámara: vista en vivo, selección de dispositivo, captura consciente, liberación del stream antes de enviar el JPEG a Ollama.
- Imagen: input nativo de archivos JPG/PNG/WEBP, máximo 12 MB; usa `prepareVisualImage` (VI-01) para convertir localmente a JPEG reducido, antes del envío. El usuario ve la misma imagen que enviará y presiona **Analizar imagen**.
- Ambos orígenes entran a `respond(...,image,false,true)`, y establecen el mismo `EphemeralVisualContext` después de respuesta válida. Se permiten preguntas visuales por voz o teclado durante máximo cinco minutos, sin nueva webcam.
- Cambiar origen, seleccionar otra imagen o cerrar descarta el contexto anterior; el adjunto del compositor fuera de este visor permanece de un solo turno.
- El modo Breve/Detallada sigue gobernando solo las respuestas visuales.
- El avatar VRM, Whisper, Kokoro, modelos locales, bridge de inferencia e infraestructura cloud no se modifican.

## QA físico recomendado

1. Con LUMIA abierta en ASUS, presionar el icono de cámara y elegir **Cargar imagen**. Seleccionar un JPG/PNG/WEBP bien enfocado: antes de **Analizar imagen** no debe haber análisis ni webcam activa.
2. Pulsar **Analizar imagen**, observar una descripción y confirmar que el visor muestra la fotografía congelada.
3. Formular tres preguntas sobre la misma imagen sin volver a cargarla. Verificar que la cámara sigue apagada.
4. Seleccionar **Detallada**, repetir una pregunta, luego **Breve**.
5. Pulsar **Elegir otra imagen**, cargar una foto diferente y verificar que la anterior dejó de ser el contexto.
6. Cambiar a **Cámara web**, verificar que abre solo entonces la vista previa y que al capturar suelta la cámara.
7. Cerrar imagen: las preguntas posteriores no deben reutilizarla. Repetir expiración a cinco minutos.
8. Intentar GIF, PDF, archivo vacío y archivo mayor de 12 MB: deben rechazarse sin procesarse.
9. Confirmar que los adjuntos habituales de la barra de conversación conservan la ruta anterior y no crean memoria oculta.
10. Revisar primera respuesta de texto, inicio de voz y duración completa en el registro.

## Certificación

`npx.cmd tsx scripts/certify-lumia-vision024-unified-input.ts`; el workflow de GitHub incluye esta prueba, las de VISION-02.3 y todas las regresiones heredadas más build y lint. CI no sustituye QA real ASUS.

**Privacidad:** no se persisten los archivos ni las fotografías autorizadas en historial; solo se conserva el JPEG analizado en memoria temporal del visor hasta cierre/reemplazo/expiración. El procesamiento se entrega únicamente al bridge local de Ollama.
