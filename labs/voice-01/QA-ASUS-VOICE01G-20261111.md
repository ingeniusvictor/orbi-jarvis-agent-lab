# VOICE-01G — A/B físico ASUS: CAM++ vs ERes2Net (2026-11-11)

**Resultado: CAM++ es candidato principal SOLO PARA LABORATORIO. A/B ejecutado realmente por el usuario en ASUS sobre 2 archivos públicos de sherpa-onnx, 3 umbrales y 2 extractores, total 12 inferencias.** No se activó en LUMIA en vivo. No se grabó micrófono ni se guardaron perfiles o transcripciones. Este informe conserva la salida textual aportada por el usuario.

## Resultados de conteo

Misma segmentación Pyannote 3.0 ONNX, mismo algoritmo de clustering, mismo entorno sherpa-onnx y dos archivos públicos: 1-two-speakers-en.wav (16 s), 0-four-speakers-zh.wav (56.861 s). Solo cambia el extractor de embeddings: ERes2Net anterior frente a CAM++ chino-inglés.

| Modelo | Archivo público | N de referencia (descripción upstream) | Umbral auto | Grupos | Coincide número | Segmentos | Tiempo ms |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| ERes2Net | 2 voices EN | 2 | 0.50 | 2 | Sí | 4 | 2687 |
| CAM++ | 2 voices EN | 2 | 0.50 | 2 | Sí | 4 | 1782 |
| ERes2Net | 2 voices EN | 2 | 0.75 | 2 | Sí | 4 | 2654 |
| CAM++ | 2 voices EN | 2 | 0.75 | 2 | Sí | 4 | 1815 |
| ERes2Net | 2 voices EN | 2 | 0.85 | 1 | No, fusión | 4 | 2671 |
| CAM++ | 2 voices EN | 2 | 0.85 | 2 | Sí | 4 | 1759 |
| ERes2Net | 4 voices ZH | 4 | 0.50 | 7 | No, sobresegmentación | 10 | 14123 |
| CAM++ | 4 voices ZH | 4 | 0.50 | 4 | Sí | 10 | 7034 |
| ERes2Net | 4 voices ZH | 4 | 0.75 | 5 | No, sobresegmentación | 10 | 13797 |
| CAM++ | 4 voices ZH | 4 | 0.75 | 4 | Sí | 10 | 7099 |
| ERes2Net | 4 voices ZH | 4 | 0.85 | 5 | No, sobresegmentación | 10 | 13754 |
| CAM++ | 4 voices ZH | 4 | 0.85 | 3 | No, fusión | 10 | 7091 |

**Coincidencias de SOLO CONTEO:** CAM++ 5/6, ERes2Net 2/6. Estas proporciones se refieren a seis combinaciones de dos grabaciones y tres umbrales; NO son métricas de accuracy de diarización, sensibilidad, precisión, DER ni generalización estadística.

**Rendimiento:** en la muestra de cuatro participantes a umbral 0.50, CAM++ tardó 7034 ms vs 14123 ms del modelo anterior: ~50.2% menos de tiempo para esa ejecución; RTF CAM++ ~0.124 vs ERes2Net ~0.248. En la muestra de dos voces (0.50), 1782 vs 2687 ms, ~33.7% menos. Los resultados se alternaron en el mismo script, pero sin repeticiones estadísticas ni medidas pico de RAM/CPU. No inferir todavía baja latencia por turno en un stream.

## Segmentos anónimos del WAV público de 4 participantes (threshold 0.50)

| Turno | ERes2Net (s; cluster) | CAM++ (s; cluster) |
| ---: | --- | --- |
| 1 | 0.318–6.865, speaker_0 | 0.318–6.865, speaker_0 |
| 2 | 7.017–10.747, speaker_1 | 7.017–10.747, speaker_1 |
| 3 | 11.455–13.632, speaker_1 | 11.455–13.632, speaker_1 |
| 4 | 13.750–17.041, speaker_2 | 13.750–17.041, speaker_2 |
| 5 | 22.137–24.837, speaker_3 | 22.137–24.837, speaker_0 |
| 6 | 27.638–29.478, speaker_4 | 27.638–29.478, speaker_3 |
| 7 | 30.001–31.553, speaker_4 | 30.001–31.553, speaker_3 |
| 8 | 33.967–37.932, speaker_5 | 33.680–37.932, speaker_3 |
| 9 | 48.040–50.470, speaker_6 | 48.040–50.470, speaker_2 |
| 10 | 52.529–54.605, speaker_0 | 52.529–54.605, speaker_0 |

Las etiquetas no asignan nombres, identidades ni garantizan veracidad humana. CAM++ agrupó turnos que ERes2Net separaba, pero NO sabemos si son la misma persona sin referencia. La diferencia de marcas temporales en turno 8 es real (inicio 33.680 CAM++ vs 33.967 ERes2Net), lo que impide afirmar que solo cambió la columna de etiqueta final.

**Se verificó SHA256 del CAM++ por el script físico ASUS:** descarga del release GitHub oficial, tamaño 28,281,164 bytes y pin SHA256 AA3CFC16963A10586A9393F5035D6D6B57E98D358B347F80C2A30BF4F00CEBA2. El hash es el publicado por copia de mantenedor; el release API antiguo no expone digest oficial. El script informa dos veces la verificación (descarga y uso), lo que no significa dos descargas.

## Decisión de arquitectura tras este gate

1. CAM++ queda como **candidato preferido en laboratorio**, con threshold auto 0.50 como BASELINE (default anterior) y 0.75 como comparación, no como umbral listo para producción.
2. ERes2Net queda como referencia reproducible; no eliminarlo.
3. **NO** activar identificación persistente de personas ni modificar el audio live de LUMIA, Qwen, Whisper, Kokoro, Speaker Shield o launchers.
4. **VOICE-01H, validación nueva:** dos WAV públicos de GitHub Release no utilizados anteriormente: 2-two-speakers-en.wav (1,088,078 bytes) y 3-two-speakers-en.wav (1,753,804 bytes), con ambos embeddings y thresholds 0.50/0.75. Solo se sabe por nombre y documentación que son muestras de dos voces; **no** son anotaciones RTTM verificadas. Ya se añadió script opcional validate-embeddings-holdout-asus.ps1; **no ejecutado aún en ASUS**.
5. Para generalizar a 3–4 personas en español, requerimos muestras independientes de adultos consentidos, anotaciones de referencia y evaluación de posibles solapamientos. Evitar sobreajuste a los dos WAV públicos anteriores.
6. Confirmar licencias de cada peso antes de distribución comercial; la licencia del código sherpa-onnx no es licencia automática para todos los modelos.

Seguimiento: Issue #78, PR #79 borrador; la rama principal no se modificó.
