# LUMIA VL-06 — Kit de certificación de voz en Windows

Repositorio: ingeniusvictor/orbi-jarvis-agent-lab
Rama: feature/lumia-voice-windows-acceptance-vl06
Base: feature/lumia-voice-vl05b-session-hardening (PR #18)
Estado: kit automatizado + métrica de piloto; audio físico todavía NO probado.

## 1. Qué se puede y qué no se puede certificar desde GitHub

El CI puede comprobar rutas de código, restricciones y cálculo de métricas.
NO dispone del micrófono, driver de sonido, altavoces, red local, claves,
Whisper/Kokoro instalados ni del permiso explícito para consumir una API.
Por lo tanto, el resultado CI PASS significa "preparado para pruebas",
no "latencia subsegundo demostrada".

## 2. Preparación Windows sin gasto ni permisos de escritura

En PowerShell, desde el directorio ya clonado del proyecto:

    git fetch origin
    git switch --track origin/feature/lumia-voice-windows-acceptance-vl06

Si la rama ya existe en el repositorio local, usa:

    git switch feature/lumia-voice-windows-acceptance-vl06

Antes de cualquier cambio local, conservar copia o commit del trabajo
sin guardar; no cambiar a la fuerza la rama de una instalación con
modificaciones. No fusionar a main.

    npm ci
    node scripts/lumia-voice-preflight.mjs

Este preflight OFFLINE muestra versión de Node, avisos y solo el estado
booleano de configuración; no lee archivos de claves ni consulta la API.
Node 22 o posterior es el objetivo del gate del repositorio.
Recomendado:

    npm run voice:doctor

El doctor describe la preparación local de Whisper, Kokoro y otros motores.

Arranca el modo normal (en otra ventana de terminal):

    npm run start:lumia

Una vez levantado el bridge (localhost:8787), ejecuta:

    CERTIFICAR_VOZ_LUMIA_WINDOWS.cmd

o, de forma equivalente:

    npm run voice:preflight

El preflight --live hace GET /health local y dos POST sin PIN al endpoint
experimental de credenciales, que DEBEN devolver 403. Uno NO incluye
Origin y el otro usa un Origin expresamente no autorizado. La auditoría
encontró que simular un PIN incorrecto desde un origen local permitido
podía bloquear al propietario tras varias ejecuciones; eso se corrigió.
Las pruebas ahora se rechazan **antes del contador de errores de PIN**,
no reciben ni envían audio, no solicitan credenciales temporales y no
llaman a ningún proveedor de pago. No afirman medir el micrófono.

Si falta el bridge o no protege los POST sin autorización: FAIL.

## Opción rápida para Windows: un solo archivo y sin cambiar .env.local

Con la rama VL-06 actualizada y `npm ci` ejecutado, haz doble clic en:

    PROBAR_VOZ_LOCAL_LUMIA_WINDOWS.cmd

Este archivo arranca LUMIA + el laboratorio acústico local mediante
variables de entorno **temporales de la terminal**. No modifica .env.local,
no instala nada, no altera Git y no solicita credenciales de pago. Fuerza
Ollama y el modo local del STT/TTS (con los fallbacks ya implementados),
apaga Realtime, ElevenLabs explícito y los ajustes de voz experimentales, y
desactiva herramientas de escritura. Para finalizar, pulsa Ctrl+C.

Si una ventana de LUMIA ya ocupa el puerto 8787, ciérrala antes de iniciar
otra: dos bridges en competencia invalidarían la prueba.

**Importante:** si no has instalado Whisper, Kokoro u Ollama, el laboratorio
de dispositivos puede funcionar, pero la prueba completa de conversación
local necesitará instalar/verificar esos componentes. El reconocimiento
por navegador puede utilizar servicios de la propia plataforma y no equivale
a un modo estrictamente sin transmisión de STT.

## 3. Laboratorio acústico local en el navegador (SIN API)

VL-06 ahora incluye un panel manual opcional para comprobar la señal del
micrófono y la salida de sonido con Chrome/Edge y Windows.

En el .env.local PRIVADO del frontend, añade:

    VITE_LUMIA_ACOUSTIC_LAB=1

Reinicia el frontend mediante el procedimiento normal. Esta variable NO
habilita la API Realtime ni ElevenLabs, y no requiere claves de pago.

Tras iniciar LUMIA, aparece a la izquierda el botón
"LUMIA · LAB ACÚSTICO". Pulsa el botón, luego "Iniciar micrófono".
El sistema suspende el reconocimiento habitual mientras dura la prueba
para evitar que LUMIA responda al tono.

Habla durante 5 a 10 segundos y observa nivel actual y pico dBFS.
Pulsando "Reproducir tono 0,5 s" se envía un sonido de 440 Hz al dispositivo
predeterminado de salida; confirma manualmente si realmente lo oíste.
El micrófono NO se conecta a los altavoces, no hay monitorización de tu propia
voz, no se guardan grabaciones y no se transmiten audios.

Pulsa "Terminar" o espera el límite de seguridad de 45 segundos, que
empieza **antes de solicitar permisos de micrófono**. Si Windows desconecta
el dispositivo o la pestaña pasa a segundo plano, el laboratorio termina
la captura y devuelve el control a LUMIA. La respuesta tardía del diálogo
de permisos no debe volver a activar la medición. LUMIA debe recuperar su
reconocimiento local. El botón "Copiar resultado sin audio"
exporta solo un resumen numérico; el indicador de pico NO prueba por sí solo
que el reconocimiento lingüístico funcione. Deshabilita la bandera después
de terminar las pruebas.

**Exclusión:** el Laboratorio y la sesión Realtime usan propiedad exclusiva
del micrófono; no pueden ejecutarse ambos simultáneamente. Durante cualquiera
de las pruebas se descartan transcripciones tardías y teclas de inicio del
asistente normal. No se fusionan a producción sin una prueba Windows real.

## 4. Prueba de voz habitual (sin API de pago)

Dejar sin activar estas banderas experimentales:
VITE_LUMIA_REALTIME_EXPERIMENT,
VITE_LUMIA_STREAMING_TTS,
VITE_LUMIA_ADAPTIVE_TURNS,
VITE_LUMIA_FAST_LOCAL_FOLLOWUP.

Comprobar los modos locales y SpeechRecognition por separado.

Con la tecla D se abre el panel. Realizar 10 preguntas cortas y 10
preguntas con pausas largas:
- "Lumi, ¿qué día es hoy?"
- "Lumi, explícame... las diferencias entre Whisper y Kokoro."
- "Sí", "continúa", "sí, pero espera un momento".
- Hablar mientras LUMIA responde: "Lumi, para".
- Hablar durante la cola acústica después de una respuesta.
- Separar dos personas y, si hay consentimiento, ruido de TV.

Registrar: proveedor STT, cola STT, tiempo de texto inicial, primera voz
audible, espera de ensamblado, falsos barge-ins, cortes, eco, idioma y
comandos duplicados.

Los tiempos de "primer texto"/"primera voz" de la respuesta normal
se miden desde la aceptación del comando, NO desde el fin físico de
la voz. No confundir con la nueva métrica WebRTC.

## 5. Opcional: piloto Realtime de pago, SOLO con autorización

No habilitar por defecto. ChatGPT Plus no incluye créditos de API.

La implementación utiliza credenciales efímeras y requiere que el
propietario configure manualmente en el servidor:
- OPENAI_API_KEY: clave API de su proyecto de pago.
- ORBIA_REALTIME_OWNER_PIN: PIN privado independiente de mínimo 12 chars.
- ORBIA_REALTIME_EXPERIMENT=1.
Y en frontend: VITE_LUMIA_REALTIME_EXPERIMENT=1.

Antes de ello, establecer límites de gasto apropiados en el proveedor.
No grabar ni subir claves, PINs o muestras de voz a GitHub.

Hacer la primera prueba con auriculares, y comprobar que la llamada
se corta voluntariamente, al ocultar la pestaña, por red fallida,
al desconectar el micrófono USB/Bluetooth, si se cierra inesperadamente
el canal de eventos WebRTC, y por límite de 90s. Al cerrar la pestaña
no se debe arrancar un nuevo reconocimiento de voz desde callbacks tardíos. Se permite un máximo de dos concesiones por
arranque del bridge. Reiniciar el proceso reinicia ese contador.

### Nuevo medidor VL-06

La ventana "LUMIA · VOZ REALTIME" muestra:
- número de muestras válidas (máximo 30, solo esta sesión);
- última latencia;
- mediana (P50);
- percentil 95 (P95);
- turnos interrumpidos/descartados.

Los tiempos provienen de eventos del canal WebRTC:
input_audio_buffer.speech_stopped -> output_audio_buffer.started.

ESTA ES LA LATENCIA ENTRE DOS EVENTOS RECIBIDOS POR EL NAVEGADOR. No
es medición de la primera muestra realmente audible en los parlantes.
Incluye la espera de VAD hasta recibir el evento speech_stopped;
no mide el intervalo total desde el final físico del habla ni la
respuesta completa.

Un botón copia únicamente estadísticas numéricas y metadatos de la
métrica a portapapeles. No hay transcripciones, audio o claves.
Recopilar 10+ muestras por configuración antes de comparar medianas
y P95. Las métricas no se guardan automáticamente ni se transmiten
a GitHub.

## 6. Condiciones para aceptar o revertir

Aprobación de audio físico requiere todas estas verificaciones:
- sin audio de LUMIA tras cancelar/ocultar la pestaña;
- sin escucharse a sí misma ni repetir su respuesta indefinidamente;
- sin perder la capacidad de continuar en modo local;
- sin comandos autorizados por una conversación Realtime aislada;
- ningún uso de herramientas o pagos por comandos desde el piloto;
- latencia y tasa de respuestas completas medidas, sin recortar frases;
- confirmación de coste real de API, cuando aplique.

Cualquier error debe documentarse con pasos reproducibles, sin datos
privados. El fallo de la prueba física bloquea la integración.

## 7. Orden de PR

VL-01 #13 -> VL-02 #14 -> VL-03 #15 -> VL-04 #16 ->
VL-05 #17 -> VL-05B #18 -> VL-06.

Estos PR son acumulativos y en borrador; no fusionar fuera de orden.
A1 autonomía sigue en una rama separada. No habilitar producción solo
porque GitHub Actions reporte PASS.
