# AMR-02.4 — LUMIA Vision AUTO conservadora (ASUS, Qwen3.5-4B-Vision4096)

**Fecha:** 2026-11-08. **Base:** AMR-02.3 (PR #60), que depende de AMR-02.2 (PR #59). **Estado:** PR draft + CI, QA físico ASUS pendiente.

## Datos observados (usuario ASUS)

Se comparó **la misma fotografía** mediante `scripts/benchmark-lumia-amr023-vision.ps1`, con la misma pregunta, `num_ctx=4096` y `think=false`:

| Lado máximo | Imagen preparada | Input tokens | Input s | Total s | Conteo emitido | doneReason |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 512 | 384×512 | 250 | 4.77 | 11.76 | 7 hombres | stop |
| 768 | 576×768 | 490 | 10.43 | 17.57 | 8 hombres | length |
| 1024 | 768×1024 | 826 | 20.95 | 28.14 | 8 hombres | length |

Estas mediciones NO son tiempos dentro de LUMIA, ni demuestran precisión de conteo por sí mismas (foto original no auditada aquí). Las respuestas a 768/1024 alcanzaron el límite de generación del benchmark. Una foto no establece rendimientos generales ni supuesta precisión perfecta de OCR.

En LUMIA (AMR-02.2, fotografía comparable), el servidor registró `total=30191ms, input=28636ms, load=11ms, inputTokens=1433, outputTokens=49, generate=1503ms, doneReason=stop`. El procesamiento de entrada es el principal candidato a optimización. No modificar pesos, reparto CPU/GPU ni prompt de razonamiento.

## Selección de imagen antes del JPEG

Se habilita **solo** con el lanzador `INICIAR_LUMIA_ASUS_VISION_AUTO.cmd`, que delega en el lanzador estable `INICIAR_LUMIA_ASUS_VISION4096.cmd`. No se cambia el valor inicial de 1024 de AMR-02.3 ni el arranque original 2B.

- **AUTO 1024:** solicitudes explícitas de leer, transcribir u observar textos, pantallas, documentos, placas, etiquetas, números de serie u OCR. Prioridad absoluta incluso si también pide contar personas.
- **AUTO 768:** fotografía/grupo/conteo/posiciones/fondo o cualquier pregunta ambigua de escena. Esta es la ruta conservadora por defecto, evita el error observado de conteo a 512.
- **AUTO 512:** exclusivamente preguntas cortas, inequívocas, sobre un objeto o color prominente. No usar 512 para conteo grupal o lectura de pequeños textos.
- **Manual 512/768/1024:** selección explícita del propietario. Prioridad frente a AUTO; botones en visor y compositor siguen accesibles. La elección dura solo esta sesión de navegador.

En el **compositor**, el texto escrito determina el tamaño antes de codificar la fotografía original; no se altera el texto ni se sube imagen hasta pulsar Enviar. En la **captura por voz** la pregunta autorizada determina tamaño antes de tomar el fotograma, y la webcam se libera inmediatamente antes de enviar el JPEG. En el **visor manual** el botón Capturar/Analizar usa la pregunta fija de descripción de escena (AUTO 768); para leer etiquetas pequeñas desde ese visor hay que elegir manualmente 1024. El archivo en visor se re-encodifica desde el File original cuando se cambia el ajuste. Una foto ya congelada y autorizada se reutiliza exactamente igual para seguimiento durante 5 minutos; no se aumenta automáticamente a 1024 si se pregunta después por texto pequeño, para no abrir la cámara de nuevo ni inventar nuevos píxeles.

No hay inferencias múltiples, reconversiones del JPEG ya codificado, capturas automáticas, archivos en disco, persistencia de preferencias o reintentos tras HTTP 500.

## Brevedad y calidad

En el piloto, cuando el modo visual es `breve`, se añade una instrucción para devolver **1-2 frases completas, hasta 40 palabras, sin listas ni encabezados** y conservando incertidumbre relevante. El modo `detallada` no recibe esa instrucción adicional. No se corta texto después de generarlo y no se reduce el límite de `num_predict=256`: evitar `doneReason=length` recortando tokens sin verificar podría producir frases incompletas.

No se altera Whisper, Kokoro, el avatar VRM, permisos, tools ni respuestas que no contienen imagen.

## Métricas sin contenido privado

- Navegador: `[lumia:vision-amr024] route source=voice|composer mode=auto|manual edge=768px reason=count-or-spatial`. Ninguna pregunta, archivo ni JPEG en los logs.
- Preparación: `[lumia:vision-amr023] prepared source=file|camera limit=768px actual=576x768 encodedChars=...`.
- Primer texto: `[lumia:vision-amr024] first-text elapsed=...ms mode=... followUp=...`.
- Servidor Ollama/bridge: `[lumia] visual local model=... context=4096 total=... input=... inputTokens=... outputTokens=... generate=... speed=... doneReason=...`.
- La línea del diagnóstico de la conversación sigue mostrando primer texto, primer audio y reproducción completa.

El registro de ruta se limita a `source`, `mode`, `edge`, `reason`; se mantiene el aislamiento de la foto de la conversación/transcript.

## Pruebas de aceptación, GO/NO-GO

1. Certificar tests unitarios y regresión completa en GitHub, incluida voz, cámara, modelo, visor, VRM y build/lint.
2. Arrancar `INICIAR_LUMIA_ASUS_VISION_AUTO.cmd` en ASUS con el modelo local `qwen3.5:4b-vision4096`.
3. Foto grupal y pregunta de conteo: AUTO 768. Leer una etiqueta: AUTO 1024 desde compositor o voz. Pregunta explícita sobre objeto único: AUTO 512.
4. Probar manual 1024 ante un conteo y manual 512 ante OCR: debe respetar la elección explícita, sin revertir a AUTO.
5. Confirmar texto coherente, `doneReason=stop` y sin HTTP 500. Comparar `inputTokens`, `input` y primer texto, con misma imagen/pregunta.
6. Verificar foto de seguimiento sin reabrir cámara y sin cambiar el JPEG. Comprobar borrar/cerrar, bloqueo concurrente y expiración a 5 minutos.
7. Revertir al lanzador `INICIAR_LUMIA_ASUS_VISION4096.cmd`: selector manual con 1024 por defecto; sin cambios en Ollama.

**GO** solo tras al menos 3 fotografías de distinta complejidad, con mejoras reproducibles y calidad visual suficiente. **NO-GO** si aparecen errores de GPU, pérdida de objetos/lectura, imágenes stale, grabación automática, confusión del modo, regresión de voz o involuntaria selección 512 para grupos.
