# LUMIA VOICE-01Q — plan de instrumentación del diarizador por etapas

**Fecha 13-11-2026. Estado: DISEÑO; no se implementó ni ejecutó VOICE-01Q.**
**Rama:** `feature/lumia-voice01-offline-diarization-lab-20261109` · PR #79 DRAFT.
No tocar LUMIA en vivo, micrófono, Qwen, Whisper, Kokoro o configuración de modelos.

## Por qué

VOICE-01M/N/O/P: pruebas CPU reales ASUS sobre dos fragmentos públicos AMI de 100 s con **cuatro hablantes manuales cada uno**. Métrica tipo DER experimental sin collar/UEM; no es DER oficial.

| Reunión | CAM++ | ERes2Net | Observación |
| --- | --- | --- | --- |
| ES2002a | 8 grupos / 13.726% | 8 grupos / 16.733% | Sobrefragmentación de p1, fallos en regiones con voces superpuestas |
| ES2003a | 4 grupos / 29.118% | 5 grupos / 33.213% | Confusión en voz única: 17.794 s-h CAM++ y 19.137 s-h ERes2Net |

Aunque CAM++ acierta el número total de grupos en ES2003a, mezcla referencias y fragmenta el hablante p0. No utilizar conteo correcto como proxy de buena diarización ni ajustar umbral automáticamente.

## Límite de la arquitectura actual

El wrapper `offline_diarization.py` crea `sherpa_onnx.OfflineSpeakerDiarization` y llama a `process(samples).sort_by_start_time()`: **únicamente retorna turnos definitivos y etiquetas anonimizadas**. El programa NO expone en este código el tensor de probabilidades del segmentador, los intervalos de regiones candidatos previos a clustering, las ventanas/embeddings por turno ni el dendrograma. Por tanto, **VOICE-01P no prueba qué etapa causó el error**. No afirmar que se pueden obtener esas salidas de la API Python sin investigar primero la versión y la interfaz real disponibles en ASUS.

## VOICE-01Q: diagnóstico propuesto por fases

1. **Verificar superficies disponibles en sherpa-onnx** de la versión exactamente instalada en el laboratorio ASUS, de manera offline y sin modificar el runtime. Leer APIs/documentación/código compatibles. Determinar si existe acceso público a: probabilidades de segmentación, turnos temporales antes del clustering, ventanas de embeddings y agrupamiento. Documentar **sí/no** por etapa y versión. No utilizar APIs no soportadas ni modificar DLLs/paquetes a ciegas.
2. **Diseñar adaptador aislado mínimo (si es viable)** que observe la cobertura temporal sin contenido: número de intervalos candidatos, segundos de habla, segundos de overlap detectado, intervalos no etiquetados, proporciones de ventanas, contadores de calidad. No exportar transcripciones, audio, embeddings ni vectores de probabilidad completos.
3. **Contrastar a referencia AMI independiente** para ES2002a y ES2003a previamente preparados, con mismos PCM16, 16kHz, SHA/RTTM, sin collares oficiales supuestos. Distinguir acierto de presencia de voz frente a identificación de grupo.
4. **Ablación controlada SOLO si etapa observable:** misma segmentación congelada + CAM++/ERes2Net; después misma extracción+variación de clustering en un ensayo preinscrito. Nunca imputar diferencias a una etapa cuando cambia otra. Mantener `num_speakers=-1` y umbral `0.50` como control; alternativas son explícitas y no mejoras de producción.
5. **Auditoría de reconocimiento simultáneo:** incluso una diarización correcta no demuestra que Whisper transcriba dos frases superpuestas ni sepa a quién responder. Se requerirá más adelante un test separado de ASR con overlaps y política de destinatario.

## Gate de aceptación

- [ ] Confirmación de capacidades reales de API local; si no existe acceso a salidas intermedias, detener instrumentación o construir un banco de referencia ONNX explícitamente separado y validado.
- [ ] Tests unitarios sin audio/red, y CI Windows/Linux.
- [ ] Ejecución ASUS voluntaria sobre ambos WAV AMI, sin micrófono ni escritura de datos de voz.
- [ ] Métricas de segmentación/overlap separadas por etapa y revisadas contra anotación, sin sobreinterpretar causalidad.
- [ ] Cero cambios al lanzador ASUS cotidiano y **cero integración** en LUMIA MASTER sin pruebas específicas.
- [ ] Plan de futuras pruebas de conversación real multihablante en español con consentimiento de participantes, sin inferir identidades.

**Prohibido:** fusionar grupos a posteriori por el número de personas manuales, afirmar que 8 grupos son 8 personas, atribuir `speaker_7` a una persona, identificar familiares, ni cambiar umbral por un único ejemplo.

**Prioridad paralela:** la visión VI-04.1 realiza ahora auditoría temporal de escenas de cámara con permiso; VOICE-01Q permanece investigación separada y NO activa audio de fondo.
