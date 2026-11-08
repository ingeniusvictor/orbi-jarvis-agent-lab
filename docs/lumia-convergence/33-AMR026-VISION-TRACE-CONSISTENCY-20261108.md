# AMR-02.6 — Trazabilidad visual por JPEG y coherencia de conteos

**Fecha:** 2026-11-08. **Base:** AMR-02.5 (PR #62), que depende de AMR-02.4, AMR-02.3 y AMR-02.2.
**Estado:** opt-in, pendiente de pruebas físicas ASUS. **No** fusionar a `main` sin aceptación.

## Evidencia ASUS y alcance

Usuario registró 17 inferencias visuales completas de `qwen3.5:4b-vision4096`. Tiempo total 2.612–29.880 ms; mediana aprox. 14.141 ms. Todas `doneReason=stop`, emisión de texto aprox. 28.3–37.7 tok/s. Procesamiento de entrada domina el tiempo. La llamada más rápida (2.612 ms, `input=1.114ms`, `inputTokens=1285`) **no prueba** un cache hit porque las métricas no identificaban foto/repetición/pregunta. El control de calidad observó respuestas contradictorias de ocho vs siete personas en el mismo grupo, y OCR con afirmaciones variables sobre un logotipo.

## Implementación opt-in

Nuevo `INICIAR_LUMIA_ASUS_VISION_TRAZA.cmd`:
- `VITE_LUMIA_VISION_TRACE_AMR026=1` (navegador Vite).
- `ORBIA_LUMIA_VISUAL_QA_AMR026=1` (Node bridge).
- Delegación completa al lanzador AMR-02.5 `INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd`.
- Los lanzadores originales 2B, Vision4096, AMR-02.4 y AMR-02.5 siguen sin cambios. Ollama Modelfile Q4_K_M 4.096 / GPU32 / batch128 NO se modifica.

### Trazabilidad privada

Para una **nueva foto codificada**, el navegador genera un `photoId` aleatorio (NO hash/fingerprint ni nombre de archivo), asociado solo al JPEG temporal:
- `[lumia:vision-amr026] prepared photo=p... source=camera|file edge=768px actual=576x768 encodedChars=...`
- En cada consulta se adjunta un `turnId` diferente y `role=new|followup|reanalysis` para identificar repeticiones del **mismo JPEG**, no imágenes similares. Si el usuario autoriza recaptura o reanálisis a 1024, eso genera un **nuevo photoId**.
- `[lumia:vision-amr026] turn turn=... photo=... role=... edge=... actual=...`
- `[lumia:vision-amr026] ws-send ask=a... turn=... photo=...`
- `[lumia] visual local model=qwen3.5:4b-vision4096 context=4096 ask=a... turn=... photo=... source=... role=... edge=... actual=... total=...ms input=...ms load=...ms inputTokens=... outputTokens=... generate=...ms speed=...tok/s doneReason=stop`
- `[lumia:vision-amr026] first-text turn=... photo=... wait=...ms`.

El backend **valida** los campos tipo enum/longitud/límites y que `encodedChars` coincida exactamente con el JPEG antes de escribir cualquier metadato. La marca de consulta real (`intent=count|ocr|scene`) se genera **antes** de añadir prompts internos, evitando falsos conteos detectados por palabras del sistema. Ningún dato de metadatos forma parte de los mensajes enviados al modelo; Ollama recibe exactamente el mismo campo `images: [image.data]` y contexto configurado.

NUNCA guardar ruta, imagen, bytes, hash de foto, texto de preguntas, transcripciones, nombres de personas ni OCR en estos registros. Los identificadores solo sirven para emparejar líneas localmente. No hay telemetría ni subida remota.

### Coherencia visual limitada

- Una tabla acotada **por conexión WebSocket** (máximo 16 entradas; TTL 5 minutos) retiene solo `photoId`, cantidad explícita de personas/figuras del grupo (2–20) y marca temporal.
- Solo extrae cifras cuando la respuesta enuncia un conteo grupal explícito (ej. «Veo ocho hombres»). Ignora cifras de voltajes, etiquetas y personas aisladas.
- Cuando el mismo JPEG recibe después un conteo grupal diferente **y la pregunta real es un conteo**, LUMIA responde que los recuentos fueron inconsistentes y solicita mejor fotografía/detalle; **no elige arbitrariamente ocho ni siete**, no genera un segundo modelo ni captura sin permiso.
- Los cambios observados durante una pregunta descriptiva quedan en el registro de estado `changed-observation`, sin alterar la respuesta. Es un detector mínimo de discrepancias, **no certifica conteos correctos** ni reemplaza un detector visual.
- Instrucciones breves específicas para OCR y conteo: lectura carácter a carácter solo de letras visibles, distinción entre marca inferida y texto confirmado, verificación de figuras sin repetir conteos ni aumentar VRAM.
- **NO** hay almacenamiento de OCR, log de texto de modelo, hash, fotografía, persistencia, segunda inferencia ni imagen mejorada automáticamente. El contexto autorizado de AMR-02.5 sigue expirando y cerrándose según su contrato.

## QA ASUS recomendado

1. Inicializar con `INICIAR_LUMIA_ASUS_VISION_TRAZA.cmd` tras `git status --porcelain` limpio y certificaciones locales.
2. Elegir FOTO1 en visor a 768px. Capturar y analizar, luego formular «¿cuántas personas?» sin recapturar. Verificar **mismo** `photoId`, **distinto** `turnId` y `ask`; las líneas de bridge exponen `inputTokens/input/total` por consulta.
3. Volver a seleccionar FOTO1 desde su original. Debe recibir otro `photoId` porque es un **nuevo JPEG**, aun cuando sea contenido similar.
4. Comprobar OCR con archivo/cámara, incluida oferta de recaptura previa bajo consentimiento y `photoId` nuevo para 1024px.
5. Comparar mínimo 3 imágenes con más de un turno (nuevas imágenes vs mismo JPEG) para valorar reutilización de prefijo/KV de Ollama. No interpretar un tiempo anormalmente rápido como caché hasta replicarlo.
6. Confirmar que no existe ninguna línea con base64, ruta local, prompt, transcripción o contenido de OCR. Comprobar 5min de caducidad, cierre de visor, sin HTTP500 y con Kokoro/VRM normales.

**Rollback:** cerrar el piloto y ejecutar `INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd` desde la misma rama. No implica revertir Ollama ni volver a descargar modelos.

## NO-GO

Errores de sintaxis/build/lint/CI, falla de cámara o voz, TTS de respuesta previa, inconsistencia de id entre navegador y Node, fuga de foto/datos, crecimiento de memoria, lecturas contradichas presentadas como certeza o aumento de latencia sistemático por las instrucciones. El piloto no pretende aún acelerar la GPU; pretende **medir, reproducir y hacer más honesta** la salida visual.
