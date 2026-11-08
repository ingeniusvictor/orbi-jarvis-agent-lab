# AMR-02.5 — LUMIA Vision contextual / consentimiento explícito

**Fecha:** 2026-11-08
**Base:** AMR-02.4 Vision AUTO (PR #61), dependiente de AMR-02.3/02.2.
**Estado:** implementación de piloto, no acreditado en ASUS hasta pruebas físicas.

## Evidencias que motivan la fase

En cuatro turnos visuales del 8 de noviembre, los tiempos hasta el primer texto fueron **16.68 / 14.22 / 15.59 / 16.14 segundos**, sin crash reportado. El modelo resumió ocho personas en la fotografía, después afirmó sin evidencia 'Todos están claramente identificados sin ambigüedades', contestó que no podía leer una etiqueta y enumeró varios colores cuando se le preguntó '¿de qué color es esto?'.

La secuencia no demuestra que el modelo aplicara 1024px a una **nueva** fotografía cuando se pidió OCR: AMR-02.4 reutilizaba el mismo JPEG autorizado en seguimientos. Los 512/768/1024 px solo se eligen **antes** de una captura o archivo nuevo. Tampoco hay certeza suficiente para afirmar que la exactitud visual esté universalmente validada por una foto.

## Nuevo comportamiento (opt-in)

Usar `INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd`; este activa la bandera `VITE_LUMIA_VISION_CONTEXT_AMR025=1` y después delega en el lanzador AMR-02.4 AUTO, conservando modelo local, GPU y audio. Los lanzadores anteriores no cambian.

### 1. Referencias ambiguas

Si el usuario pregunta de una foto **ya congelada** «¿de qué color es esto?» o «¿qué es esto?» sin especificar a qué se refiere, LUMIA pide una referencia concreta. Lo resuelve localmente, sin nueva inferencia ni nueva cámara. **No** intercepta la primera pregunta al capturar un objeto puntual y no pretende identificar objetos por heurísticas.

### 2. Foto vieja de menor detalle / OCR

Si el usuario pregunta por lectura detallada, un texto pequeño, una placa o número de serie, y la fotografía autorizada se creó con 512/768px:
- **Archivo** cargado desde el visor: LUMIA explica la limitación, muestra un botón de autorización y conserva exclusivamente en memoria el objeto `File` original mientras dure la misma sesión visual de 5 minutos. Al pulsar **Reanalizar archivo original a 1024 px**, re-encodifica el original a 1024px y procesa la **pregunta que motivó la solicitud**. Revalida la generación antes de enviar bytes y abandona el resultado si el usuario cerró o cambió foto.
- **Cámara**: LUMIA ofrece **Volver a encuadrar a 1024 px**. Tras el clic, abre únicamente la vista previa autorizada (con expiración a 90s); todavía se requiere un segundo clic en **Capturar y analizar** para crear y enviar el nuevo fotograma. El análisis intenta responder la pregunta original del usuario. No captura automáticamente.
- Si no hay original conservado, pide seleccionar otra fotografía o autorizar otra captura, sin simular que la imagen de 768px se puede ampliar para recuperar texto.
- Si el fotograma original ya es de 1024px, se analiza con el JPEG existente y se informa de la incertidumbre real; no se fuerza una repetición.

### 3. Calibración del lenguaje

Las respuestas visuales en el piloto reciben una instrucción adicional: distinguir **contar personas** de **identificar personas**, evitar frases como 'sin ambigüedades' cuando no es justificable, y reconocer texto ilegible sin inventar marcas. Son **instrucciones**, no un clasificador de certeza ni garantía de que el modelo nunca sobreafirme. No se reescribe la respuesta con filtrado ciego.

### 4. Privacidad y reversión

- Una imagen en el visor se conserva en la memoria del navegador por un máximo de 5 minutos; el objeto `File` conserva **exactamente el mismo TTL** (y solo existe si el usuario cargó un archivo en el visor).
- Cerrar el visor, cambiar la fuente, seleccionar nueva fotografía o caducar el contexto revoca el JPEG y cualquier archivo original.
- El Compositor de fotografía en una sola solicitud continúa siendo **one-shot**; no conserva originales ni genera sesiones visuales sin autorización.
- Las preguntas de seguimiento reutilizan la foto actual; nunca se crea silenciosamente una segunda imagen.
- No se ejecuta OCR fuera de Ollama, no hay capturas automáticas, ni almacenamiento persistente, ni cambios en el proveedor de voz, VRM, permisos, modelos o Modelfile.
- Registros `[lumia:vision-amr025] detail-offer|approved` registran solo origen y resolución, nunca imagen/pregunta/archivo.
- Rollback inmediato al lanzador `INICIAR_LUMIA_ASUS_VISION_AUTO.cmd`.

## QA ASUS / GO-NO-GO

1. Probar la misma foto grupal. Preguntar «¿cuántas personas?» y verificar que la respuesta no confunda conteo con identidad personal.
2. Preguntar «¿de qué color es esto?» en seguimiento. Debe pedir aclaración sin enviar otra fotografía ni abrir cámara. Luego precisar «la camisa del hombre a la derecha» y verificar nuevo análisis con la misma foto.
3. Desde visor, cargar fotografía con texto fino y analizar primero a 768px. Después pedir lectura de la etiqueta: debe mostrar opción para **reanalizar original a 1024**, sin envío nuevo antes del clic. Después del clic, debe presentar JPEG preparado a partir del original y contestar la pregunta pendiente.
4. Con cámara, capturar a 768px y pedir OCR: ofrecer nueva vista previa 1024. Verificar que todavía se necesita pulsar **Capturar y analizar** y que se liberan los recursos antes de Ollama.
5. Cerrar o cambiar foto durante la preparación: el resultado antiguo no debe iniciar inferencia. Tras 5 minutos, no deben quedar JPEG/original disponibles para reanálisis.
6. Comprobar que el lanzamiento AMR-02.4 previo sigue igual (selector AUTO, sin oferta AMR-02.5), y que el 2B estable conserva su inicio original.
7. Recolectar logs `[lumia] visual local ...` y diagnóstico de voz para latencia real; no prometer mejoras de tiempo basadas en respuestas locales automáticas sin Ollama.

**GO** después de CI exitoso y pruebas visuales reales (ambigüedad, OCR archivo, cámara, cierre y TTL). **NO-GO** si se pierde privacidad o se bloquea la cámara, el origen no corresponde a la foto actual, no se puede cancelar reanálisis o aparecen fallos de modelo.
