# LUMIA VI-03.1 — Sesión de visión activa (piloto ASUS)

## Problema de usuario

El visor VISION-02 actual exige «Capturar y analizar» y luego «Volver a encuadrar» para cada nueva observación. En pruebas del 8 noviembre de 2026, Qwen3.5 2B ya describió personas, camiseta NASA y bebida rojiza en varias fotografías con primer texto ~4,4–4,9 s. Sin embargo, algunas descripciones confundieron *camiseta NASA* con *uniforme espacial* y no siempre incluyeron las dos personas visibles.

## Solución implementada

En el mismo visor se ofrece **Activar visión** (solo con el lanzador VI-03.1). Requiere que el usuario primero abra el visor de cámara y conceda permiso al navegador. La sesión:

- Mantiene vista previa **visible** y un control **Detener visión**.
- Captura un JPEG inmediatamente y luego **cada 12 segundos** en memoria, sobrescribiendo la instantánea anterior.
- Termina automáticamente a los **3 minutos como máximo desde la activación**; se corta antes por cierre, cambio de origen, pérdida de cámara o pestaña oculta.
- Conserva el visor de 90 segundos para el modo manual cuando no se activa la nueva sesión.
- Permite usar **Analizar ahora** sin cerrar la webcam.
- Reconoce preguntas visuales explícitas por voz como «Lumi, ¿qué ves ahora?» y adjunta el **último fotograma** si tiene **20 segundos o menos**.
- No envía automáticamente un fotograma a Ollama en cada ciclo: la inferencia local se inicia solo tras una pregunta visual o pulsar Analizar ahora.
- No graba videos ni envía imágenes fuera del bridge local. Las instantáneas no se persisten en disco, transcripciones ni almacenamiento del navegador. El contexto previo de fotografía sigue teniendo el TTL existente de 5 min, sujeto a cierre.
- Si el usuario pregunta si algo *cambió* o *se movió*, no atribuye variaciones sin comparación entre dos fotogramas. Esto necesitará VI-03.2.

## Límites técnicos

No es análisis de video a 30 FPS, seguimiento real de identidad o detección de movimiento. Es muestreo visual local de baja frecuencia con consultas **bajo demanda**, para conservar la fluidez de Qwen3.5 2B + Kokoro y no provocar respuestas no solicitadas.

No cambia modelos, cuantización, GPU, segmentación TTS ni el flujo de imágenes manuales. El nuevo feature flag es `VITE_LUMIA_VISION_ACTIVE_VI031=1`, y **activar ese flag no abre la webcam**. La webcam solo se usa tras la acción explícita del visor y el consentimiento del navegador.

## QA físico (ASUS)

1. Instalar rama VI-03.1 sin sobrescribir cambios locales; ejecutar `npx.cmd tsx scripts/certify-lumia-vision031-active-session.ts`.
2. Abrir LUMIA con el lanzador VI-03.1, comprobar Qwen 2B, Kokoro y cámara seleccionable.
3. Abrir el visor; confirmar que no hay análisis automático. Pulsar **Activar visión**. Comprobar webcam encendida, indicador y contador ascendente cada ~12 s.
4. Mover un objeto de mesa. Por voz: «Lumi, ¿qué ves ahora?». Comprobar que responde usando el fotograma más reciente sin cerrar la cámara.
5. Probar «Lumi, ¿qué cambió?». Debe reconocer que una sola imagen no demuestra cambios, y no inventar movimiento.
6. Pulsar **Analizar ahora**. Debe iniciar inferencia sin volver a encuadrar y mantener vista previa.
7. Preguntar algo no visual («Lumi, explica qué hace un inversor»). Confirmar que no se adjuntó JPEG ni se ralentizó la conversación textual.
8. Pulsar **Detener visión**: apagar cámara cuando el último módulo libera su lease; comprobar que no hay más muestras; pregunta posterior no debe usar último JPEG activo.
9. Repetir con pestaña oculta / cambio de origen; debe terminar. Comprobar caducidad de 3 min.
10. Repetir con permiso de cámara denegado, webcam virtual vacía y fuente cambiada; sin análisis inventado.
11. Comparar latencias de texto/voz de consultas visuales con la línea base AMR-03.0 y registrar errores perceptivos de forma separada.

## Próximo incremento — VI-03.2: ver cambios de verdad

Agregar una ventana efímera de exactamente **dos instantes** etiquetados A/B para comparaciones visuales reales, con consentimiento visible y diagnóstico de falsos positivos de movimiento. No inventar desplazamiento a partir de un solo fotograma. Más adelante: sesiones de atención a objetos, zonas y lectura técnica con QA físico.
