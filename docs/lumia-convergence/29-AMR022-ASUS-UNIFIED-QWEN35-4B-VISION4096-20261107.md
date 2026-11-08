# LUMIA · AMR-02.2 — ASUS unificado Qwen3.5 4B-Vision4096 (piloto reversible)

**Fecha:** 2026-11-07
**Base:** AMR-02.1 Qwen3.5 4B-Fast vision context + diagnóstico seguro
**Estado:** código y pruebas CI por certificar; verificación en ASUS pendiente.

## Investigación de Aragón recibida

El usuario informa certificación local de un nuevo perfil `qwen3.5:4b-vision4096` (Ollama 0.40.13, GTX 1650 Ti 4 GiB, 32 GiB RAM). Modelfile declarado:

```dockerfile
FROM qwen3.5:4b-fast
PARAMETER num_ctx 4096
PARAMETER num_batch 128
PARAMETER num_gpu 32
PARAMETER temperature 0.2
```

Según los experimentos informados por Aragón: Q4_K_M sin recuantizar, CPU+GPU ~76%/24% en `ollama ps`, VRAM 2639-2649 MiB en visión, 36.65 tok/s en texto y 36.58 tok/s de generación visual HD. Procesa un JPEG sintético de 256x256, una prueba de formas HD y dos frases OCR. Imagen 1024x768: 22.19 s en la prueba. Los valores se consideran **resultados informados, no mediciones replicadas desde esta sesión ni garantía de rendimiento**. El éxito de OCR en ejemplos no certifica OCR universal. El 0.49 s de una figura simple no permite prometer 1-3 s para cualquier escena.

La causa raíz del 4B-Fast original informada por Aragón es OOM CUDA al alojar proyector CLIP + capa de salida totalmente en GPU; pudo reproducir `num_gpu=33` falla, `num_gpu=32` pasa. **No inferir que el frontend era culpable:** el fallo HTTP 500 se reproducía directamente llamando Ollama con imagen sintética.

## Cambios AMR-02.2

- **Nuevo lanzador opcional** `INICIAR_LUMIA_ASUS_VISION4096.cmd`: verifica con `ollama show` que el modelo existe localmente; activa `LUMIA_ASUS_MODEL_OVERRIDE=qwen3.5:4b-vision4096` y `JARVIS_OLLAMA_KEEP_ALIVE=30m` **solo durante esta sesión**, luego reutiliza todo el lanzador estable y sus switches de Whisper/Kokoro, STT, TTS, cámara, visión, VRM, animaciones y selector AMR-02.
- **Lanzador anterior** `INICIAR_LUMIA_ASUS_RAPIDA.cmd` sigue iniciando 2B si no hay override; no cambia su comportamiento por defecto. No se fuerza instalación, descarga, eliminación o conversión de modelos. `main` no se modifica.
- **Perfil visual 4B-Vision4096** en `vision-profile-amr021.mjs` explícito: API manda `num_ctx=4096`, `num_predict=256`, `temperature=0`. El `num_gpu=32` y `num_batch=128` permanecen **en el Modelfile del modelo**, no se sobrescriben en el API. 4B-Fast conserva 2048 y el 2B conserva 4096.
- **Diagnóstico visual sin imagen**: además de nombre de modelo/contexto/tiempo, escribe `inputTokens` (tokens de prompt), `outputTokens`, tiempo de generación, tok/s y `doneReason`; **nunca** datos JPEG/base64 de la foto. Visual falla de forma honesta, sin describir la imagen ficticiamente ni cambiar modelo sin autorización.
- El perfil en Ollama **no puede ser validado o creado remotamente aquí**: depende del perfil local existente en el ASUS de usuario.

## Importante sobre memoria

- `JARVIS_OLLAMA_KEEP_ALIVE=30m` es tiempo de residencia solicitado por el **bridge**, no cambia la configuración del daemon global. Puede favorecer conversación fluida, pero retener un modelo consume memoria. Nunca usar `-1` por defecto en un equipo de 4 GiB.
- No se asume que variables `OLLAMA_MAX_LOADED_MODELS` y `OLLAMA_NUM_PARALLEL` definidas desde un CMD afecten al servicio ya iniciado. Si el usuario decide configurarlas a 1, hay que reiniciar Ollama y registrar el cambio.
- Se deja `OLLAMA_FLASH_ATTENTION` y `OLLAMA_KV_CACHE_TYPE` como estén en la configuración del servidor existente. No forzar nuevas variables durante el piloto.
- El selector AMR-02 puede seleccionar manualmente 2B u otros modelos; no se añade un segundo modelo automático para visión porque generaría swaps y falsa certidumbre.
- No redimensionar indiscriminadamente capturas a 512: escenas finas y OCR pueden perder información y el perfil ya pasó una prueba HD. Mantener 1024 px como máximo inicial; crear un futuro control explícito de resolución / tipo de tarea solo después de QA en LUMIA.
- El `ollama ps` porcentaje GPU/CPU describe distribución de memoria/capas, no garantiza porcentaje de operaciones computacionales.

## QA ASUS que falta

1. Cerrar LUMIA, revisar estado limpio de Git, actualizar a la rama AMR-02.2.
2. `ollama list` y `ollama show qwen3.5:4b-vision4096`: confirmar `vision`, `num_ctx 4096`, `num_batch 128`, `num_gpu 32`. No recrear el modelo desde el proyecto.
3. `npx.cmd tsx scripts/certify-lumia-amr022-unified-vision4096.ts` (estático + integración) y lanzar `INICIAR_LUMIA_ASUS_VISION4096.cmd`.
4. Verificar modelo elegido en la barra y por voz; hacer primero conversación y tool read-only: probar que no rompe JSON, Whisper, Kokoro ni visual.
5. Repetir el mismo JPEG autorizado y preguntar por objetos/colores; observar línea `[lumia] visual local model=qwen3.5:4b-vision4096 context=4096` y `inputTokens`, `outputTokens`, `doneReason`. Confirmar que la imagen no genera error HTTP 500.
6. Preguntar por texto pequeño: valorar tiempo real, no prometer 1-3 s; comparar con modo breve y detallado si aplica.
7. Comprobar `ollama ps` y `nvidia-smi` **mientras ejecuta**. Pueden existir discrepancias post-crash.
8. Volver al launcher original y comprobar que el cerebro predeterminado continúa siendo 2B. No fusionar PR hasta pruebas de máquina física.

## Criterios Go/No-Go

**Go:** carga segura, 4096 real, imagen exitosa y honesta en LUMIA, latencia razonable en tu uso, text JSON completo, puente/TTS/cámara/VRM y selector sanos.

**No-Go:** HTTP 500, crash, intercambio de modelos inesperado, JPEG de evidencia incorrecto, distorsiones de texto fino, VRAM insuficiente, cámara o avatar rotos. Ante fallo, cerrar piloto y reiniciar `INICIAR_LUMIA_ASUS_RAPIDA.cmd` con 2B; no eliminar modelos ni sobrescribir `main`.
