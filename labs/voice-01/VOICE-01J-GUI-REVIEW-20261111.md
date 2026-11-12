# LUMIA VOICE-01J — Revisor GUI offline de clips (2026-11-11)

**Alcance:** nueva interfaz gráfica de Windows en el laboratorio aislado, tras la reproducción física PASS de siete fragmentos (VOICE-01I). La interfaz **ya se abrió y utilizó en la ASUS para seleccionar opciones y copiar un resumen**; falta evaluar los botones de reproducción dentro de esta GUI y cerrar las dos respuestas pendientes del Audio 3. No se activa en LUMIA en vivo, no modifica Whisper, Kokoro, Qwen ni micrófono, y no produce RTTM ni identifica personas.

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


## Primera revisión auditiva real compartida por el propietario (11-11-2026)

Se recibió el resumen copiado de la interfaz física en ASUS:

| Campo | Respuesta suministrada | Estado |
| --- | --- | --- |
| Audio 2: C suena como | incierto | Respondido; **NO** confirma que speaker_2 sea otra persona |
| Audio 2: hay dos voces simultáneas | si | Observación auditiva **subjetiva** de simultaneidad en el intervalo de revisión 17.5–19.5 s |
| Audio 3: C suena como | pendiente | Sin revisar; no inferir respuesta |
| Audio 3: D suena como | pendiente | Sin revisar; no inferir respuesta |

**Interpretación cuidadosamente limitada:** hay concordancia cualitativa entre la observación de voces simultáneas y los intervalos de CAM++ que se superponen 0.253 s en Audio 2 (17.817–18.627 vs 18.374–21.142), pero no hay anotación con precisión temporal humana ni identificación por nombres. La comparación A/B/C para Audio 2 queda incierta. **No tenemos opinión alguna sobre C o D del Audio 3.**

El hecho de haber copiado este resumen desde la interfaz es evidencia de ejecución real en ASUS de **apertura de GUI, interacción con opciones y función de copiar texto**, pero no certifica que todos los botones de audio en la GUI hayan sido probados ni que se haya guardado JSON local. La anterior prueba CLI VOICE-01I sí certificó reproducción de siete clips fuera de la GUI. 

**Próximo gate reducido:** reproducir en la pestaña Audio 3 los clips A, B, C y D, comparar C y D (A/B/C/otra/incierto), sin necesidad de volver a reproducir Audio 2. Si ambas respuestas permanecen inciertas, conservar ese resultado como incertidumbre válida. No forzar conteo ni pasar el modelo a LUMIA en vivo.

## Segunda revisión auditiva parcial comunicada (11-11-2026)

El propietario copió un **nuevo resumen** desde VOICE-01J, con dos respuestas modificadas respecto al anterior:

| Campo | Primera evaluación | Segunda evaluación | Estado |
| --- | --- | --- | --- |
| Audio 2: C suena como | incierto | **otra** | Opinión auditiva cambió; **no prueba tercera persona real** |
| Audio 2: hay dos voces simultáneas | sí | **incierto** | La simultaneidad está **sin confirmar**, pese al solapamiento detectado por algoritmo |
| Audio 3: C suena como | pendiente | pendiente | Falta respuesta |
| Audio 3: D suena como | pendiente | pendiente | Falta respuesta |

**Criterio de QA:** conservar las dos valoraciones cronológicas, sin reescribir la primera como si nunca hubiera existido. La segunda, más reciente, no se declara verdad terreno; revela variabilidad o incertidumbre humana. Los intervalos que la diarización etiquetó con superposición (**17.817–18.627 y 18.374–21.142 s**) se solapan matemáticamente 0.253 s, pero ahora la percepción de voces simultáneas es **incierta**. El nuevo juicio «otra» acerca de C no valida que haya efectivamente tres personas ni invalida por sí mismo la descripción pública de un archivo de dos voces.

**Pendiente:** dos campos del Audio 3; escuchar los clips de 1–6, 14–20, 27–30 y 48–53 s, y comparar C/D con los ejemplos. Si no son distinguibles, registrar «incierto» en vez de completar por conjetura. No convertir este revisor en reconocimiento de identidad real; no modificar CAM++ ni el umbral global basándose en estas respuestas.

## Tercera revisión auditiva parcial comunicada (11-11-2026)

El propietario compartió otra salida de la GUI VOICE-01J. Se registra como **tercera evaluación subjetiva distinta**, no como sustitución ni corrección retroactiva de las anteriores:

| Campo | Primera | Segunda | Tercera |
| --- | --- | --- | --- |
| Audio 2: C suena como | incierto | otra | **otra** |
| Audio 2: hay dos voces simultáneas | sí | incierto | **no** |
| Audio 3: C suena como | pendiente | pendiente | **pendiente** |
| Audio 3: D suena como | pendiente | pendiente | **pendiente** |

**Lectura cautelosa:** la categoría «otra» para el Audio 2 C se repite en las revisiones 2 y 3, pero **no verifica que exista un tercer hablante distinto**. La percepción de simultaneidad pasó de «sí» a «incierto» y finalmente «no»; por tanto, **no hay confirmación humana estable del solapamiento**. El algoritmo conserva su resultado: intervalos 17.817–18.627 s y 18.374–21.142 s se superponen matemáticamente 0.253 s; eso no demuestra que ambas señales vocales sean audibles de forma simultánea ni que la anotación automática sea correcta.

**Estado VOICE-01J:** evaluación de Audio 2 reiterada tres veces; Audio 3 C/D siguen sin evaluarse. No calcular DER, no concluir cantidad real de personas, no modificar el threshold ni pasar CAM++ a LUMIA en vivo. Próximo paso: **abrir la segunda pestaña «Audio 3» de la GUI**, escuchar los botones A (1–6 s), B (14–20 s), C (27–30 s) y D (48–53 s) y completar solo esos dos selectores; «incierto» es un resultado legítimo.

## Limitaciones explícitas

1. La observación del oyente es **subjetiva y parcial**: escuchar unos fragmentos no equivale a etiquetar todos los turnos del WAV ni a medir DER.
2. Las etiquetas A/B/C/D son temporales **por grabación**, no nombres ni perfiles biométricos.
3. El archivo JSON local solo representa respuestas voluntarias; un valor "otra" no demuestra por sí solo un tercer hablante real en la grabación completa.
4. Las pausas, ruidos, voces simultáneas y segmentos omitidos no quedan totalmente anotados; para evaluar diarización rigurosamente se requiere un RTTM completo con límites y verificación independiente.
5. El uso real de la GUI en ASUS está **parcialmente validado** por un resumen copiado: apertura, controles de selección y portapapeles. CI comprueba además importación Tk y lógica sin altavoces; falta confirmar los botones de escucha dentro de la GUI antes de marcar la fase completa PASS.

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
- QA física parcial: ventana, interacción y copia de resumen confirmadas en ASUS. Queda pendiente confirmar todos los botones de reproducción de la GUI, la persistencia de selección entre pestañas y que no se guarde JSON hasta pulsar Guardar; **el guardado es totalmente opcional**.
- Recolección perceptual opcional: el usuario decide si C corresponde a A/B/otra/incierto, y si las dos intervenciones alrededor del segundo 18 se solapan. Las opiniones se registran como opiniones, no como verdad terreno.

**Protecciones:** archivos del repositorio no guardan WAV/ONNX ni biometría, PR #79 sigue en borrador, sin cambios a main ni al programa cotidiano de LUMIA.
