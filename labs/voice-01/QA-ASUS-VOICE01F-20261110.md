# VOICE-01F — QA físico ASUS: control fijo y clustering automático (10-11-2026)

**Estado:** inferencia exitosa; estimación automática MULTIHABLANTE NO resuelta. Evidencia del PowerShell del propietario; solo audios de ejemplo públicos. Sin micrófono, perfiles ni identificación biométrica.

## Resultado de las cinco ejecuciones

| Prueba | Esperado | Detectado | Segmentos | elapsed_ms |
| --- | ---: | ---: | ---: | ---: |
| 4 fijo (num-speakers=4, control) | 4 | 4 IMPUESTO | 10 | 12216 |
| 4 auto threshold=0.75 | 4 | 5 | 10 | 12168 |
| 4 auto threshold=0.85 | 4 | 5 | 10 | 12122 |
| 2 auto threshold=0.75 | 2 | 2 | 4 | 2295 |
| 2 auto threshold=0.85 | 2 | **1 (fusión incorrecta)** | 4 | 2349 |

Todos los procesos completaron. La condición de cuatro grupos fijados sirve como CONTROL, no demuestra detección autónoma ni exactitud frente a identidades reales.

## Segmentos en el archivo público de cuatro voces

| Segmento, segundos | Grupo fijo k=4 | Grupo automático 0.85 |
| --- | --- | --- |
| 0.318–6.865 | speaker_0 | speaker_0 |
| 7.017–10.747 | speaker_1 | speaker_1 |
| 11.455–13.632 | speaker_1 | speaker_1 |
| 13.750–17.041 | speaker_2 | speaker_2 |
| 22.137–24.837 | speaker_0 | speaker_0 |
| 27.638–29.478 | speaker_3 | speaker_3 |
| 30.001–31.553 | speaker_3 | speaker_3 |
| 33.680–37.932 (fijo) / 33.967–37.932 (auto) | speaker_3 | **speaker_4** |
| 48.040–50.470 | speaker_2 | speaker_2 |
| 52.529–54.605 | speaker_0 | speaker_0 |

La etiqueta speaker_0 no equivale a una persona real ni es estable entre grabaciones. Hubo diferencias de tiempo (33.680 frente a 33.967); no asumir resultados idénticos. Sin segmentos etiquetados por humanos, no afirmar que la asignación de turnos es correcta.

## Conclusión VOICE-01C/E/F

En los umbrales 0.50/0.55/0.60/0.65, el archivo de 2 participantes estimó 2 y el de 4 estimó 7. En 0.75 fueron 2 y 5. En 0.85 fueron 1 y 5. **No existe umbral probado que resulte correcto para ambas muestras.** Forzar el número correcto no corrige necesariamente las asignaciones.

## Próximo ensayo VOICE-01G, sin modificar LUMIA

El módulo agregado `compare-embeddings-asus.ps1` realiza ahora una **comparación A/B real en la misma sesión**: ejecuta tanto ERes2Net como CAM++ chino-inglés con los mismos dos WAV públicos, los mismos cortes 0.50/0.75/0.85 y Pyannote Segmentation 3.0 sin cambios. Son **12 inferencias** y la tabla muestra conteo esperado, detectado, coincidencia de conteo (solo descriptiva), segmentos y tiempo. El candidato es el release sherpa-onnx `3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx`, tamaño 28 281 164 bytes. SHA256 `aa3cfc16963a10586a9393f5035d6d6b57e98d358b347f80c2a30bf4f00ceba2`, contrastado con [la publicación de `csukuangfj` (mantenedor upstream) en Hugging Face](https://huggingface.co/csukuangfj/speaker-embedding-models/blob/main/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx); **no es un digest publicado en el GitHub Release API**. Descargar del release oficial y verificar antes de usar; no guardar modelos en Git. El indicador `CountMatch` **no** valida atribución humana ni DER.

Reverb Diarization v1 NO es candidato para ORBI en producción: su licencia Rev Model Non-Production restringe el uso comercial/productivo y la distribución en un servicio. Véase https://huggingface.co/Revai/reverb-diarization-v1/blob/main/LICENSE.

El nuevo experimento está pendiente de ejecución física ASUS. No fusionar PR #79 a main ni integrar en vivo. Se requiere validación adicional con referencia humana y español de adultos consentidos.

Continuidad: https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78 ; https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79
