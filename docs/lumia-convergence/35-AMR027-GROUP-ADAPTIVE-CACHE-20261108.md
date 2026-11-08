# AMR-02.7 — Resolución adaptativa para grupos + métrica real de caché

**Fecha:** 2026-11-08. **Rama base:** AMR-02.6.1 / PR #64. **Estado:** piloto opt-in; no modificar `main`.

## Evidencia de ASUS (fotografía de referencia)

Imagen de grupo proporcionada por el usuario: **8 personas en total, 7 de pie y 1 agachada**. Se observaron errores repetidos de siete personas a 768 px, mientras las consultas a 1024 px reconocieron ocho. Esto es **evidencia de esa fotografía**, no una validación global de precisión, y la formulación de preguntas también influyó.

En el puente, el segundo de dos JPEG preparados a 768 px (IDs distintos) tardó **1.721 ms**, de los cuales `input=285ms` y `generate=1.378ms`. La consulta previa tardó **16.418ms**, con `input=14.848ms`. Esto sugiere reutilización de trabajo de entrada, pero los ID por JPEG no equivalen a hashes de contenido; dos IDs diferentes pueden representar el mismo archivo. No concluir «caché acertada» sin el campo oficial `prompt_eval_cached_count` de Ollama.

## Qué se implementó

- `INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd` define `VITE_LUMIA_VISION_ADAPTIVE_AMR027=1` y `ORBIA_LUMIA_VISUAL_CACHE_AMR027=1` y delega en la versión estable AMR-02.6.1. Sin tocar el Modelfile, 32 capas GPU, batch 128, Qwen3.5-4B-Vision4096 ni contexto 4096.
- `src/lib/vision-routing-amr027.ts` permite 1024 px automáticamente **solo** para fotos nuevas cuando la **pregunta menciona explícitamente contar personas/grupos/multitudes**. La selección manual (512/768/1024) siempre gana; OCR sigue en 1024; escenas genéricas continúan 768; objetos simples 512. No se afirma que LUMIA pueda identificar multitudes analizando píxeles antes de Ollama.
- Se aplica al flujo de cámara solicitado por voz y al compositor con archivo y texto. El visor de archivo/cámara cuyo disparador genérico es «describe esta imagen» continúa preparándose a 768 px en AUTO porque no hay inspección de objetos previa y no debe haber inferencia oculta.
- Para un **seguimiento sobre el JPEG de 768 px** cuyo usuario pide contar personas, el piloto ofrece **reanalizar el archivo original a 1024 px** o **volver a encuadrar la cámara**. Ambos requieren permiso **explícito**, usando el sistema de AMR-02.5. Nunca reescala un JPEG reducido para simular detalle ni abre la webcam automáticamente. Los botones cambian el texto según la intención («grupo» u «OCR»). Si se pulsa la opción de cámara, sigue siendo necesario pulsar «Capturar y analizar».
- `bridge/orbia/vision-cache-metrics-amr027.mjs` lee `prompt_eval_cached_count` de la respuesta `/api/chat` y agrega `cachedTokens=N cachedShare=P%` **solo cuando el campo existe y es numéricamente válido**. Cuando no existe, registra `cachedTokens=unavailable` (nunca lo reemplaza por 0). La presencia de tokens en caché no prueba por sí sola que los píxeles de la imagen estén en caché; puede ser un prefijo de texto.
- Permanece la correlación `photo`, `turn`, `ask`, `edge`, `actual`, `inputTokens`, `input`, `total` y `doneReason` de AMR-02.6. No se registra contenido de imágenes, ruta, textos, nombres, OCR ni hashes.

## Cómo realizar una prueba controlada

1. Cerrar LUMIA y ejecutar el nuevo lanzador. Verificar que sigue seleccionada la versión Qwen3.5-4B-Vision4096.
2. Con la misma foto original, probar por separado a 768 y 1024 px usando **exactamente la misma pregunta** y unas cuantas repeticiones. En cada caso registrar si se contaron ocho, los tiempos de `input` y el campo `cachedTokens` si existe.
3. En el visor con AUTO (768 para la primera descripción genérica), preguntar «¿cuántas personas aparecen y cuántas están de pie?». Debe ofrecer **Reanalizar grupo a 1024 px** sin invocar otra inferencia; pulsar el botón autoriza un nuevo JPEG desde el archivo original.
4. En el compositor, adjuntar un archivo con la pregunta escrita «Cuenta a las personas de esta fotografía». En AUTO debe preparar directamente 1024 px.
5. Si la cámara está habilitada, la pregunta explícita de conteo al solicitar una **nueva** foto debe pedir 1024 px; si ya existe un JPEG reducido, primero deberá ofrecer volver a encuadrar y solicitar captura.
6. Probar OCR y el control manual de 512/768/1024; ninguna opción puede anularse silenciosamente.
7. Comprobar que `cachedTokens=unavailable` indica falta de información y **no** un fallo de Ollama ni evidencia de que no se usó caché.

## Validación y rollback

La certificación específica `scripts/certify-lumia-amr027-group-cache.ts` prueba la política AUTO, control manual, consentimiento para JPEG antiguo, ausencia de métrica vs valor cero y el único envío de imagen hacia Ollama. La CI hereda toda la regresión de voz, cámara, VRM y AMR-02.6.1.

Rollback del piloto: cerrar LUMIA y ejecutar `INICIAR_LUMIA_ASUS_VISION_CONSISTENTE.cmd`; para recuperar también el código anterior del piloto, cambiar a la rama AMR-02.6.1. La nueva rama no modifica ningún lanzador antiguo ni `main`.

**Limitación fundamental:** el piloto no puede conocer si una imagen genérica muestra un grupo sin analizarla; por ello, la resolución adaptativa en primera captura depende de la pregunta. Solo resultados físicos en ASUS pueden validar ganancias de precisión o tiempos reales.
