# LUMIA AMR-02.1 — Diagnóstico y contexto visual para Qwen3.5 4B-Fast

**Origen:** Prueba ASUS del 7 de noviembre de 2026, 22:35:21.
**Síntoma:** la cámara/fotografía se captura y LUMIA contesta a los 19,13 s que «el modelo no consiguió analizarla», sugiriendo erróneamente que tal vez no admita visión.

## Evidencia y alcance
- Qwen3.5:4b-fast, Q4_K_M, **declara** `vision`. Con `num_ctx=2048`, `think=false`, modelo residente y contexto de texto: hasta 40,41 tok/s y 100% GPU en `ollama ps`.
- En la rama AMR-02 anterior, la ruta `streamOllama({image})` siempre solicitaba `num_ctx:4096`, sobrescribiendo el Modelfile optimizado y pudiendo requerir mayor KV/contexto, recarga y/o más VRAM. **Posible causa, no verificada sin error Ollama.**
- La UI ocultaba la razón concreta del error y sugería incorrectamente que faltaba capacidad de visión.
- Hay además un proyector visual; tener 100% GPU en pruebas de texto **no garantiza** que visión quepa en 4 GiB. La imagen de hasta 1024 px puede requerir más memoria y tokens de contexto.

## Corrección AMR-02.1
- Para `qwen3.5:4b-fast`, la API visual ahora usa `num_ctx:2048`, sin afectar modelos no optimizados (continúan en 4096) ni modificar la imagen JPEG.
- El diagnóstico en la consola local registra nombre del cerebro, contexto solicitado, categoría de fallo y un motivo acotado. Nunca registra JPEG/base64/historial de la foto.
- El mensaje hablado ya no confunde indiscriminadamente fallos de memoria, contexto o servidor con incompatibilidad visual.
- **Sin fallback automático a 2B:** si el análisis 4B falla, la aplicación conserva el cerebro seleccionado y no inventa una observación visual. El usuario puede seleccionar explícitamente el 2B desde AMR-02.
- Whisper, Kokoro, avatar, visión 02.4.2, vida de JPEG (5 minutos), historial textual y selector AMR-02 permanecen intactos.

## QA local ASUS
1. Con el PR certificado, actualizar la rama y ejecutar `npx.cmd tsx scripts/certify-lumia-amr021-fast-vision.ts`.
2. Verificar `ollama list`, elegir `qwen3.5:4b-fast` desde el botón de la barra inferior; `ollama ps` debe indicar `CONTEXT 2048` al menos **después de la petición visual** si la carga tuvo éxito.
3. Analizar **la misma imagen** usada en VISION-02.4.2 y repetir preguntas sobre el cielo, las personas y la camisa. Observar el terminal del bridge, no solo el diagnóstico de voz.
4. Si falla: copiar **solo** las líneas `[lumia] visual inference failed ...` y las salidas de `ollama ps` y `nvidia-smi`, sin imágenes/base64/contraseñas. Identificar si es memoria, contexto, runner o defecto desconocido.
5. Volver al 2B y repetir la misma foto. No afirmar que el 4B visual quedó certificado hasta que exista una respuesta correcta desde ASUS.
6. Comprobar que un fallo visual no preserve como “analizada” la captura fallida y que los cambios por voz y botón continúen intactos.

## Criterio de aprobación
- CI lint/build/regresiones OK y AS​​US: captura -> inferencia 4B-Fast -> descripción visible correcta, sin descarga forzada a CPU ni comportamiento inesperado de cámara.
- Si el contexto de 2048 no admite la combinación de prompt+imagen o la VRAM se agota por el proyector, la próxima opción será un perfil visual específico probado o usar 2B visual de manera explícita. Evitar una degradación oculta del modelo.
