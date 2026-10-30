# LUMIA CG-01 — Registro real del 28 de octubre: pérdida de contexto

## Evidencia recibida
El archivo COPIAR REGISTRO muestra 9 turnos completos (16:34 a 16:45). No respalda que la aplicación se bloquee físicamente al cuarto turno: la sesión seguía capturando STT y generando texto.

- 16:35:43 pregunta sobre cuánto escucha LUMIA; el modelo inventó que dependía de RAM/OS, pese a que los límites de escucha están en código.
- 16:37 a 16:39 varias preguntas sobre ASUS se transcribieron en modo WAKE sin una activación reconocida. No se procesaron: no hay turno asociado.
- 16:39:55 una segunda parte de las características de GPU fue recibida como GUARD mientras LUMIA hablaba, por lo que no se incorporó al turno.
- 16:42:47 Whisper captó «Tú ni se te pido hacer un resumen» y LUMIA respondió erróneamente en términos de la pregunta anterior.
- 16:42:50 una continuación «De un informe, ¿podrías hacerlo?» apareció durante GUARD y no se integró.
- 16:43:19 la petición explícita «si te doy un informe, ¿puedes hacer un resumen?» fue reconocida, pero Qwen respondió casi exactamente lo mismo que en el turno anterior.
- 16:45:10 la pregunta sobre llamar por otro nombre recibió la misma respuesta vieja, palabra por palabra.

## Tratamiento CG-01
La ruta de Ollama no usa una caché de respuestas: llama al modelo por turno y pasa el historial de hasta 8 mensajes. Es una hipótesis fundamentada, no una prueba concluyente, que el modelo pequeño se ancló en la respuesta anterior. La corrección CG-01, en la ruta **buffered JSON** de Ollama, identifica respuestas largas muy similares a una de las tres respuestas anteriores, cuando la pregunta actual es distinta y no se pidió repetir. Una sola regeneración usa el mensaje actual, una pista mínima de contexto y una instrucción explícita de no repetir la respuesta anterior. Si falla, responde con una explicación breve, nunca con la misma respuesta reciclada.

No se modifica la rama principal, Whisper, Voice Gate, duración de seguimiento, GLB, tamaño del avatar, Kokoro ni APIs pagas. La ruta de streaming experimental no cambia porque podría haber emitido ya audio cuando se detecta repetición.

## Pendiente en ASUS
Confirmar que la corrección funciona sobre Qwen local con preguntas consecutivas. El archivo no registra petición HTTP a Ollama ni tokens de salida del modelo; no permite distinguir con certeza perseveración del modelo de un hipotético cruce de peticiones en un servicio externo, aunque el controlador de mensajes usa ID de solicitud.

La pregunta sobre resumen debiera contestarse afirmativamente y pedir que se proporcione el informe. La pregunta sobre otros nombres debiera explicar que el nombre de activación se reconoce con variantes concretas; no fingir reconocimiento universal. Además queda un problema separado de *guard vs COMMAND*: frases pronunciadas durante el habla o el tiempo de espera antieco se clasifican como GUARD, y no deben admitirse libremente sin activación por riesgo de audio ambiental.
