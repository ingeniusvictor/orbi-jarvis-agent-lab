# LUMIA AMR-02 — Selector local de cerebros en la barra inferior

**Fecha:** 7 noviembre 2026. **Base:** VISION-02.4.2 (commit `f2d1b6036d40c5c80481408d541095677ba98a0a`).

## Objetivo
Seleccionar con un clic cualquiera de los modelos Ollama **realmente instalados**, sin hablar ni escribir un comando. Dejar la selección por voz intacta y sincronizar ambos métodos.

## Implementación
- Un icono pequeño de procesador al lado de los controles de la barra inferior `LumiaComposer`, sin modificar el VRM, Whisper, Kokoro o carga de fotos.
- Un menú flotante compacto que muestra las etiquetas exactas de Ollama, marca el modelo activo, permite actualizar la lista y evita seleccionar el ya activo.
- Una acción WebSocket local `model_ui` con `action=list|switch`, identificador de solicitud y **etiqueta instalada exacta**. El servidor verifica contra `probeOllama()`, calienta el modelo con `warmOllama` antes de `setActiveModel` y conserva el anterior si falla.
- Eventos `model_ui_state` al conectarse, tras selección por voz y tras selección por clic. La interfaz se actualiza de forma reactiva y limpia el estado al desconectarse.
- No se envían turnos falsos a la conversación, no se habla un texto de confirmación, no se cambia el modelo de TTS/STT y no se descargan modelos automáticamente.
- El botón no permite cambios durante respuestas en curso y el dock bloquea envíos durante el calentamiento.
- La configuración activa sigue siendo temporal en el proceso Ollama/bridge, como en el cambio original por voz. Tras reiniciar el servidor se conserva el modelo de arranque configurado; no se añade persistencia nueva.

## QA física ASUS
1. Ejecutar `ollama list` y comparar nombres con las opciones del menú, incluyendo `qwen3.5:2b-q4_K_M`, `qwen3.5:4b` y `qwen3.5:4b-q4_K_M` si están instaladas.
2. Abrir LUMIA, pulsar el icono de procesador en la barra inferior, ver listado y cerebro activo.
3. Seleccionar `qwen3.5:4b-q4_K_M`; comprobar estado “preparando” y que se marque activo sin respuesta hablada.
4. En otra ventana `ollama ps`; pedir una pregunta por texto y otra con fotografía para comprobar el cerebro en uso (la GPU puede repartir RAM).
5. Cambiar de vuelta mediante voz a un modelo inequívoco; confirmar que el selector actualice el cerebro activo.
6. Probar que el selector no actúe mientras LUMIA genera una respuesta, que un modelo no instalado no aparezca, que los cambios fallidos mantengan el activo y que reconectar recupere el estado.

## QA automática
`npx.cmd tsx scripts/certify-lumia-amr02-model-dock.ts` más compilación, lint y regresión completa.

## Riesgos y límites
- La RAM/VRAM y la velocidad siguen dependiendo del modelo Ollama instalado. El selector no garantiza que un 4B quepa enteramente en GPU.
- No incorpora métricas ni persistencia de preferencias.
- El QA estático y CI no reemplazan la prueba interactiva real en Windows.
