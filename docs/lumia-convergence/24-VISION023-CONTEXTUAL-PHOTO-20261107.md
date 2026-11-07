# LUMIA VISION-02.3 — Conversación contextual sobre la última fotografía

## Continuidad de QA ASUS · sábado 7 de noviembre de 2026

El usuario verificó físicamente VISION-02.2 en ASUS con `USB2.0 HD UVC WebCam`. Dos capturas autorizadas mostraron escenas reales y Qwen3.5-2B produjo descripciones pertinentes. Primera respuesta visual textual a los **5,15 s / 5,61 s**; reproducción inicial a los **7,02 s / 7,77 s**; respuestas completas a los **27,00 s / 31,69 s**. Las respuestas visuales funcionaron bien, pero eran relativamente largas en voz.

El usuario aceptó implementar **conversación visual contextual**: preguntar por detalles de la misma imagen sin abrir la webcam de nuevo, y un modo breve para reducir la duración de la narración.

## Capacidades implementadas

- Después de una foto de cámara explícitamente autorizada, LUMIA mantiene **únicamente ese JPEG** en una referencia de memoria privada del navegador, con plazo máximo de **5 minutos**, no en el almacenamiento del navegador, disco, archivos, logs, GitHub ni transcripción. Al cerrar el visor, reencuadrar, capturar una nueva imagen o vencer el plazo, se descarta la referencia.
- Una vez que Ollama terminó correctamente la primera respuesta, LUMIA puede recibir preguntas naturales por voz o texto: «Lumi, ¿qué hay detrás?», «¿De qué color es la camiseta?», «¿Cuántas personas aparecen en la foto?», «¿Y el fondo?», «¿Qué más puedes observar?». Se adjunta **otra vez el mismo JPEG** a la solicitud de Ollama, sin encender la webcam ni fingir acceso continuo a la escena.
- Se puede escribir directamente una nueva pregunta desde el visor de la imagen congelada. Ese formulario está autorizado explícitamente a consultar la misma foto incluso si la pregunta no contiene las palabras «imagen» o «foto».
- Un clasificador conservador descarta consultas ajenas a la imagen («¿qué hora es?», «dime el clima», «cambia avatar», «programa una función») para conservar el recorrido rápido de voz sin imágenes. Solicitudes explícitas de una foto nueva vuelven a requerir permiso/flujo de cámara habitual.
- **Respuesta visual Breve (predeterminado):** instrucciones para una o dos frases, aproximadamente hasta 40 palabras. **Detallada:** explicación más extensa y delimitación de lo que no se distingue. Ambos afectan solo las respuestas con imagen, sin reconfigurar Qwen, Kokoro, Whisper ni los mensajes normales de texto.
- El panel muestra «Foto temporal · 5 minutos · se descarta al cerrar» y controles para cambiar el modo de respuesta.

## Arquitectura

1. `src/lib/vision-context-vi023.ts`: `EphemeralVisualContext` (una sola imagen, token monotónico contra respuestas obsoletas, confirmación de análisis completo, TTL y borrado) y clasificador de preguntas visuales.
2. `src/App.tsx`: captura de voz VISION-02/visor VISION-02.1, confirmación posterior a Ollama, detección de pregunta contextual y reutilización del JPEG en `ask(prompt,history,handlers,image)`. No llama `captureLumiaAuthorizedStill` cuando hay una referencia visual válida. Descarte explícito al cerrar; si hay una inferencia visual aún activa, se interrumpe.
3. `src/ui/LumiaCameraViewfinder.tsx`: selector visual Breve/Detallada y pequeño formulario para preguntar por la foto congelada sin abandonar la interfaz.
4. `src/index.css`: estilos locales compactos sin mover la barra de controles ni el avatar.
5. `scripts/certify-lumia-vision023-contextual-photo.ts`: QA sintético de solicitudes en español, preguntas no visuales, token anterior, TTL exacto 300.000 ms, borrado, botón explícito, ruta de Ollama con imagen y preservación de capacidades de VISION-02.2.
6. `.github/workflows/lumia-vision023-visual-context.yml`: compuerta completa heredada de voz/Whisper/Kokoro/VRM, VI-01, VISION-02/02.1/02.2, build y lint.

## Restricciones de privacidad

- Solo se conserva temporalmente la fotografía autorizada; el backend puede mantener **el texto del diálogo** como anteriormente, pero no introduce fotos en el historial de conversación del bridge.
- No almacena fotografías de personas o menores, no reconoce identidades, no registra rutas de archivo o nombres de cámara en prompts, no inicia streams en segundo plano y no envía imágenes fuera del Ollama local configurado.
- No promete borrar memorias internas de un modelo o del runtime ajeno; el alcance del control es la referencia retenida por esta aplicación en el navegador.
- Cerrar la imagen cancela también un análisis visual en curso, si aún se está ejecutando.
- El modelo puede equivocarse; la respuesta debe distinguir observaciones de inferencias. No presentar evaluación de personas como una identificación.

## Pruebas físicas ASUS

1. Abrir `http://localhost:5173/` con la rama VISION-02.3 y confirmar **Cámara → vista en vivo → Capturar y analizar**.
2. Elegir **Breve** y fotografiar un objeto con otros elementos detrás. La respuesta visual debería ser más corta que las observadas previamente (comparar primera voz y duración total en diagnóstico).
3. Con la imagen fija, sin volver a encender cámara, decir «Lumi, ¿qué hay detrás?» y «Lumi, ¿de qué color es el objeto?». Debe utilizar la **misma fotografía**, no inventar observación en vivo.
4. Escribir en el formulario del visor «¿Y a la izquierda?»; debe responder a esa foto aun cuando no se haya pronunciado la palabra «fotografía».
5. Seleccionar **Detallada** y preguntar por otra parte de la imagen; la respuesta debería tener más contexto sin afirmaciones no verificables.
6. Preguntar «Lumi, ¿qué hora es?» con la foto aún abierta. Debe conservar la ruta ordinaria, sin enviar el JPEG.
7. Cerrar el visor y preguntar por la foto anterior; **no debe reutilizarla**. Una captura nueva solo se permite mediante petición explícita o botón Cámara.
8. Dejar la foto fija abierta por cinco minutos: el panel desaparece al expirar la referencia.
9. Confirmar que cámara liberada/LED apagado entre preguntas visuales y que no hay pausas añadidas a conversaciones normales.
10. Confirmar que VISION-02.2 (selector de webcam), VI-01 (fotografías adjuntas), PH-04.8, los 17 FBX y los controles por voz siguen funcionando.

## Gestión de ramas

Trabajo exclusivo de la línea **asistente VISION** en `feature/lumia-vision023-contextual-photo-20261107`, basada en VISION-02.2. PR draft, `main` intacta. La evolución física del VRM continúa en el otro chat.
