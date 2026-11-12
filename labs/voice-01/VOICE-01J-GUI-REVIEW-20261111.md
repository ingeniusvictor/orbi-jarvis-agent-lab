# LUMIA VOICE-01J — Revisor GUI offline de clips (2026-11-11)

**Alcance:** nueva interfaz gráfica de Windows en el laboratorio aislado, tras la reproducción física PASS de siete fragmentos (VOICE-01I). La interfaz **todavía no se ha ejecutado físicamente en ASUS**. No se activa en LUMIA en vivo, no modifica Whisper, Kokoro, Qwen ni micrófono, y no produce RTTM ni identifica personas.

## Por qué existe

VOICE-01H mostró que CAM++ todavía detecta grupos adicionales en dos WAV oficiales presentados como grabaciones de dos personas: 2-two-speakers-en.wav y 3-two-speakers-en.wav. La reproducción de VOICE-01I funcionó, pero un log que enumera clips reproducidos **no es evidencia de que los grupos correspondan a personas distintas**. El revisor facilita la evaluación perceptual sin obligar a copiar los tiempos manualmente.

## Funcionalidad implementada

- GUI de biblioteca estándar **Tkinter**, sin dependencias Python nuevas, con dos pestañas.
- Audio 2: botón A (0.2–2.5 s), B (3–6.5 s), C (21.5–26.5 s), y clip de posible solapamiento (17.5–19.5 s); selector de si C suena como A/B/otra voz/incierto; selector de si se oyen voces simultáneas.
- Audio 3: botón A (1–6 s), B (14–20 s), C (27–30 s), D (48–53 s); selectores anónimos para comparar C y D con los anteriores.
- El audio se reproduce desde memoria usando voice01_listen.build_excerpt() y winsound.PlaySound(..., winsound.SND_MEMORY), de forma síncrona. **No graba, no exporta WAV, no crea micrófono adicional y no necesita acceso a internet.**
- **No guarda nada por defecto.** El usuario debe pulsar "Guardar revision local (JSON)" para crear un archivo de respuestas sin audio bajo %LOCALAPPDATA%/ORBI/LUMIA-VOICE-LAB/reviews/. Cada guardado utiliza un nombre con fecha/hora; no sobreescribe una evaluación existente. El JSON contiene los nombres de archivos públicos, SHA256 de los archivos y respuestas A/B/C/otra/incierto sin nombres personales.
- Botón "Copiar resumen para ChatGPT": genera texto breve con las cuatro respuestas y lo copia al portapapeles para compartirlo voluntariamente. Ni el programa ni el repositorio transmiten ese texto automáticamente.
- Antes de abrir la GUI valida ambos WAV frente a los **tamaños y SHA256 observados físicamente en ASUS**. El hash local no sustituye una firma/digest de procedencia oficial, pero impide abrir por accidente otro archivo en vez de los audios públicos.
- Modo --doctor imprime un estado sin abrir GUI ni audio. --consent obligatorio para lanzar la ventana.

## Limitaciones explícitas

1. La observación del oyente es **subjetiva y parcial**: escuchar unos fragmentos no equivale a etiquetar todos los turnos del WAV ni a medir DER.
2. Las etiquetas A/B/C/D son temporales **por grabación**, no nombres ni perfiles biométricos.
3. El archivo JSON local solo representa respuestas voluntarias; un valor "otra" no demuestra por sí solo un tercer hablante real en la grabación completa.
4. Las pausas, ruidos, voces simultáneas y segmentos omitidos no quedan totalmente anotados; para evaluar diarización rigurosamente se requiere un RTTM completo con límites y verificación independiente.
5. Tkinter GUI en Windows será probado físicamente en ASUS antes de marcar VOICE-01J PASS; CI solo comprueba importación Tk y lógica sin ventana/altavoces reales.

## Comando de ejecución, solo Windows

Actualizar exclusivamente el worktree independiente a la rama feature/lumia-voice01-offline-diarization-lab-20261109. No reinstalar modelos ni usar scripts de LUMIA en vivo.

~~~powershell
$lab = Join-Path $env:USERPROFILE "LUMIA-VOICE-LAB"
$data = Join-Path $env:LOCALAPPDATA "ORBI\LUMIA-VOICE-LAB"
$py = Join-Path $data ".venv\Scripts\python.exe"

& $py -B (Join-Path $lab "labs\voice-01\voice01_review_gui.py") --doctor
& $py -B (Join-Path $lab "labs\voice-01\voice01_review_gui.py") --consent
~~~

Si la ASUS no tiene Tkinter en el Python base, la UI fallará con error de importación y **no debemos instalar indiscriminadamente nada en el entorno de LUMIA**; revisar la instalación local de Python/venv primero. La GUI utiliza el entorno aislado ya probado.

## Gate de cierre

- CI Windows/Linux: pruebas sintéticas para valores de radio, validación del SHA del audio, guardado solo por acción explícita, ausencia de sobreescritura, y modo --doctor. Windows valida importación de Tkinter, **no** la reproducción con altavoces en ASUS.
- QA física pendiente: la ventana abre, reproducen los 8 botones, las selecciones se conservan entre pestañas, el resumen se copia correctamente y no hay archivo local antes de pulsar Guardar.
- Recolección perceptual opcional: el usuario decide si C corresponde a A/B/otra/incierto, y si las dos intervenciones alrededor del segundo 18 se solapan. Las opiniones se registran como opiniones, no como verdad terreno.

**Protecciones:** archivos del repositorio no guardan WAV/ONNX ni biometría, PR #79 sigue en borrador, sin cambios a main ni al programa cotidiano de LUMIA.
