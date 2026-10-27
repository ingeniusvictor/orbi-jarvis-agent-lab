# LUMIA TL-01 — Historial cronológico de conversación

## Motivo

En una prueba física en Windows se reportó una respuesta que tardó
aproximadamente 40 segundos y, ante una segunda pregunta, apareció un
error sin respuesta hablada. No se puede identificar el origen de esos
40 segundos con una captura sin marcas horarias; no se debe atribuir
esa demora exclusivamente a Whisper, Ollama ni Kokoro sin evidencias.

## Qué queda visible en pantalla

- La fecha local de Windows/Chrome **una sola vez** encima del holograma.
- Cada frase reconocida en la columna ESCUCHANDO tiene hora exacta
  `HH:mm:ss.SSS` y un rótulo como FONDO, STT, GUARD, etc.
- Si el STT es Whisper/ElevenLabs local, muestra también la duración
  de conversión y transporte para ese segmento. El navegador no expone
  una duración STT equivalente y allí solo aparece la hora de resultado.
- Cada comando aceptado incluye su hora local.
- La columna RESPUESTA muestra inmediatamente una fila vacía
  `ESPERANDO RESPUESTA` al empezar una solicitud al cerebro.
  Tras 15 s sin texto, la fila indica `DEMORA · SIN TEXTO`, con
  un contador transcurrido. **Es un aviso, no un timeout ni una cancelación.**
- Al primer fragmento de respuesta, se conserva su hora y la
  diferencia respecto al momento en que se aceptó el comando.
- Cuando la salida de audio dispara el callback de inicio real de
  reproducción, se guarda la hora de ese evento y su latencia.
  No se afirma detectar el primer sonido percibido en el altavoz.
- Cuando termina `spk.end()` se marca COMPLETA, con tiempo total.
  Si el cerebro termina sin texto, se marca SIN RESPUESTA.
  Si arroja una excepción se marca ERROR, la hora y el mensaje;
  si otro comando desplaza la respuesta, INTERRUMPIDA.
- El aviso general de error en pantalla también lleva hora.

**Los tiempos del cerebro comienzan al ACEPTAR el comando**, no en el
instante físico en que la persona empieza a hablar. Sumando la
duración de STT en cada segmento se pueden separar etapas; el
ensamblado y la VAD se observan en el panel de diagnóstico D.

## Cómo compartir evidencia con ChatGPT

Mientras la conversación está abierta, haz una prueba de dos preguntas.
Si una tarda o falla, no recargues la página. El botón
`COPIAR REGISTRO` (debajo de la fecha) copia las horas,
frases, estados, latencias y mensajes de error de esta sesión.
Pega esa información directamente en ChatGPT para que podamos
identificar si el error ocurrió antes de aceptar el comando,
durante la consulta al cerebro o después, en la salida de voz.

El registro se almacena **solo en el estado temporal del navegador**,
no se envía automáticamente, no se graba audio y no contiene
credenciales o identificadores de las APIs por diseño. No obstante,
contiene el TEXTO de las conversaciones y mensajes de error:
revísalo antes de compartirlo si la conversación fue privada.

Los paneles conservan un buffer limitado de líneas (60 escuchadas,
41 intervenciones) en memoria, no un archivo histórico indefinido.
Al recargar la página, los datos desaparecen.

## Instalación de la fase

Rama: `feature/lumia-conversation-timeline-tl01`
Basada en AV-01B, PR #20; dependencias de VL-06/VL-05B y anteriores.
Los GLB originales y nuevos continúan **solo en Windows**, no en GitHub.
El módulo de tiempos no modifica escala/posición del nuevo rostro ni
selección de Whisper/Kokoro/Ollama.

Si en Windows el propietario ha instalado parches locales de
`src/scene/LumiaAvatar.tsx` u otros, guardar respaldo/commit local
ANTES de cambiar a esta rama para evitar perderlos; no usar
`git reset --hard` para aplicar la nueva implementación.
No hay activación de API de pago.
