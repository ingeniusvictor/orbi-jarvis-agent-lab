# AMR-02.9 — Comparar Qwen3.5 2B original vs 4B modificado en ASUS

**Fecha:** 2026-11-08. **Base:** AMR-02.8 / PR #66. **Alcance:** evaluación local, *sin modificar los modelos*. Esta fase responde a la observación del usuario de que LUMIA parecía más rápida y natural con el modelo 2B.

## Principio

Decidir la versión que mejor sirve al asistente real por **calidad, capacidad de respuesta y experiencia de voz**, no por el número de parámetros. El 4B modificado `qwen3.5:4b-vision4096` usa el perfil GPU/CPU certificado. La versión estándar `qwen3.5:2b` se mantiene intacta. No se instalan, eliminan, reconfiguran ni cuantizan modelos. La ejecución está limitada al localhost de Ollama; ni fotografía ni prompts van a un proveedor cloud.

## Evaluación automática: misma máquina, mismas preguntas

`scripts/benchmark-lumia-amr029-model-comparison.ps1` hace una pasada con las siguientes tareas y presenta tanto la **respuesta** como el tiempo desglosado de ambos modelos:

1. **Escritura sencilla:** qué es un string fotovoltaico y qué hace un inversor. Revisar claridad y brevedad.
2. **Escritura con razonamiento:** si los strings comparables entregan 8 A y 10 A, el primero es **20 % inferior** respecto de 10 A. Revisar cálculo `(10-8)/10 × 100`, interpretación correcta y recomendación de verificación segura sin manipular conectores energizados.
3. **Respuesta para hablar:** qué revisar primero cuando un inversor no genera y no hay alarmas visibles, sin intervenir equipos energizados. La llamada usa el **mismo esquema JSON {respuesta:string} de la ruta hablada real de LUMIA**, con `num_predict=120`. Esto prueba *únicamente el cerebro que redacta lo que Kokoro diría*, **no** mide Whisper, síntesis Kokoro ni el primer audio real.
4. **Visión:** un único JPEG de la foto seleccionada (768 px inicialmente, o 1024 con `-Edge 1024`) enviado con la misma pregunta y mismo prompt de visión a ambos modelos. Para la foto de referencia son **8 personas, 7 de pie, 1 agachada**. No se codifica ni fuerza ese total en el prompt; se comprueba examinando las respuestas reales.

El informe separa tiempo de pared, `total_duration`, `load_duration`, **tiempo sin carga**, procesamiento de entrada, generación, tokens entrantes/salientes, caché y `done_reason`. No hay calentamientos ocultos. Una primera carga y el cambio de modelo pueden sesgar la velocidad: no interpretar el tiempo total como tasa estable de generación. Los modelos pueden diferir en cuantización/perfil Modelfile, algo relevante para su comparación práctica.

La fotografía se selecciona una vez, se reescala desde el original en **RAM** y se envía a cada modelo con exactamente los mismos bytes del JPEG. La codificación es System.Drawing calidad 76; no idéntica byte a byte a Canvas del navegador. Ningún dato de imagen, audio, respuesta, nombre o pregunta se guarda en disco; el script imprime las respuestas para que el usuario pueda evaluar. No hay CSV ni exportación automática.

## Evaluación de voz real (interfaz LUMIA)

**Dos rondas sin alterar el runtime de voz:**

1. Abrir LUMIA con `INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd` (se mantiene el lanzador anterior; AMR-02.9 no agrega otro).
2. Confirmar que **STT Whisper y TTS Kokoro residentes** están activos y que la modalidad de micrófono y dispositivo se mantienen iguales.
3. En **CEREBRO LOCAL**, elegir primero `qwen3.5:2b`; si no aparece, consultar `ollama list`. Nunca crear ni descargar un sustituto sin permiso.
4. Decir por micrófono exactamente la pregunta de la prueba automática de voz: «Lumi, si un inversor fotovoltaico deja de generar y no veo alarmas, ¿qué revisarías primero sin intervenir equipos energizados? Responde en dos frases».
5. Guardar o copiar el **DIAGNÓSTICO DE CONVERSACIÓN**: comprobar que Whisper transcribió la misma frase; anotar primer texto, primer audio, finalización y si se interrumpió. Leer el log del puente `[orbia] LUMIA local latency model=...` para aislar la inferencia del tiempo de STT/TTS.
6. Cambiar solo el cerebro en **CEREBRO LOCAL** a `qwen3.5:4b-vision4096`; repetir idéntica pregunta, con mismo perfil de voz, sin tocar GPU y sin otras tareas simultáneas. Comparar la calidad de respuesta, ausencia de invenciones, velocidad de primer texto y primer audio.
7. **Una pregunta de seguimiento** por modelo puede medirse aparte, pero no mezclar con la primera respuesta o una recarga; siempre registrar qué modelo estaba activo. Si las transcripciones Whisper difieren, la comparación no mantiene la misma entrada: repetir la medición.

**Whisper y Kokoro son independientes del LLM**: diferencias en el contenido pueden alterar la duración del audio, incluso usando idéntica voz. Para comparar el retardo del cerebro, usar los tiempos de Ollama y para la experiencia, inicio de reproducción. No atribuir a 2B/4B diferencias del micrófono o TTS.

## Ejecutar directamente en la ASUS

```powershell
cd C:\Users\ingvm\LUMIA-ASUS
npx.cmd tsx scripts/certify-lumia-amr029-model-comparison.ts
# La política actual de PowerShell restringe .ps1; usar Bypass solo en el nuevo proceso:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\benchmark-lumia-amr029-model-comparison.ps1" -ImagePath "C:\ruta\foto-de-8-personas.jpg" -Edge 768
```

El script exige los tags exactos instalados. Si falta el 2B, mostrar `ollama list` y detener, sin suponer que existe ni instalar otra variante.

## Criterios de decisión

- Si el 2B es mucho más rápido con respuestas correctas y suficientes en texto, voz e imagen, **considerarlo cerebro diario**.
- Si el 4B mejora tareas difíciles, considerar mantenerlo como opción para consultas complejas o visión exigente; no forzar 4B para todo.
- Si ambos cuentan ocho en la foto, esto no demuestra igualdad general: solo se evaluó una imagen y un prompt.
- Nunca seleccionar automáticamente un cerebro nuevo o modificar la configuración GPU basándose en una única foto.
- La CI verifica código, perfiles, PowerShell y regresiones; **no afirma haber oído micrófono ni probado Ollama en la ASUS**.

## Privacidad, reversibilidad

Se heredan los lanzadores y todas las garantías de AMR-02.8 / AMR-02.7. Solo se agregan scripts y documentación, sin cambios en `src`, `bridge`, `main` ni `INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd`. Para interrumpir, cerrar el proceso PowerShell; ningún cambio del sistema requiere rollback.
