# LUMIA VQ-03.4 — QA Whisper → Qwen → Kokoro, 14-11-2026

**Estado:** mejora semántica acotada y experimental en PR #83, no aplicada a `LUMIA-ASUS` original. Voice assets compartidos por lectura desde la instalación original con VQ-03.3. No fusionar al original sin evidencia física.

## Evidencia real (14-11-2026, 01:39–01:41, ASUS QA)

El usuario habilitó el micrófono y compartió diagnóstico del laboratorio:

| Turno hablado | Transcripción Whisper-local | Primer texto | Primer audio | Pausas internas | Evaluación |
| --- | --- | ---: | ---: | --- | --- |
| «Explícame en dos frases qué es un avatar VRM» | «Lumi, explícame en dos frases que es un VRAM» | 2,38 s | 3,45 s | Segundo audio: 3 ms, Kokoro/WAV 0 ms | Fallo STT VRM→VRAM; Qwen respondió sobre memoria gráfica, asunto incorrecto |
| Consulta para animaciones más naturales | «Lumi, ¿cómo podrías mejorar tus animaciones para que esperan de manera más natural?» | 1,10 s | 2,74 s | Audio #2: **1256 ms**, de ellos **1250 ms Kokoro/WAV**; #3: 19 ms | STT produjo «esperan» y Qwen interpretó tiempo de espera (delay), no movimiento natural |
| Controlar animaciones en conversación | «Lumi, ¿cómo podrías controlar mejor tus animaciones mientras conversamos?» | 1,24 s | 4,07 s | Audio #2: **1183 ms** (Kokoro/WAV 1159); #3: **776 ms** (Kokoro/WAV 758) | Qwen respondió pero sugirió `pause`/`resume` sin evidencia de que sean comandos habilitados |

**Confirmado:** `command/speech (whisper-local)` tres veces, voz Kokoro/WAV real, `STT local->local` y `TTS local->local` del arranque físico anterior, `Kokoro resident ready`. Círculo de voz local funcional; el contenido semántico NO aprueba y la reproducción tiene pausas de síntesis mensurables.

**No inferir:** no consta la duración física del habla, ni la tasa real de acierto general Whisper, ni un benchmark estadístico de Kokoro. No demostrar que los conceptos `pause` y `resume` estén implementados por haberlos pronunciado.

## Causa y reparación VQ-03.4

1. `bridge/orbia/vrm-tech-grounding-vq03.mjs`: `clarifyVq03AmbiguousTechnicalSpeech` reconoce `un VRAM` en consulta definitoria sin pistas GPU, y pregunta **«¿VRM avatar 3D o VRAM GPU?»**. Nunca reemplaza silenciosamente el STT. No intercepta «¿Cuánta VRAM dedicada necesita una GPU?» ni definiciones con GPU explícita.
2. El mismo clasificador detecta la frase sintácticamente anómala `animaciones para que esperan ... natural` y solicita confirmar si se quiso decir que **se vean/se muevan más naturales**; no deriva a ajustes de delay sin consentimiento.
3. `technicalVrmSystemHint` ahora también reconoce preguntas sobre **tus animaciones** / control mientras conversamos, e inyecta **solo al SYSTEM prompt de Qwen** un recordatorio de estados `escucha/pensamiento/habla/reposo`, mezclas Motion R8 y visemas, y prohíbe afirmar que `pause`/`resume` son comandos existentes sin implementación verificada. Esta medida reduce la probabilidad de invenciones, pero no garantiza contenido: requiere QA real.
4. `bridge/ollama.mjs` consulta el clasificador únicamente bajo `ORBIA_LUMIA_VRM_GROUNDING_VQ03=1`, después de los controles de voz / modelo y registro de capacidades, antes de una llamada generativa. Respuestas de aclaración reutilizan el contrato existente de `onText/done`; el texto STT y el historial se conservan como los produjo el usuario.
5. `scripts/certify-lumia-vq03-vrm-clarity.ts` prueba literalmente las tres frases reales, ejemplos genuinos de VRAM/GPU, comandos y regresión VQ-03.1.

## Kokoro, incidente separado

Pausas atribuibles a Kokoro/WAV: **1250, 1159 y 758 ms** en tres fragmentos. No son «espera de texto del modelo» (0 ms). No cambiar simultáneamente la segmentación, los modelos o el motor antes de una comparación A/B controlada. Prioridad futura: medir caché/prefetch, tamaños de fragmento, colas del residente y si el primer audio se produce antes de que esté listo el siguiente. Mantener un par de frases de prueba idénticas para comparar con y sin optimización. No instalar ni descargar otros pesos; conservar VRM/R8 y modelo Qwen 2B estable.

## QA física del parche

Después de CI Win/Linux PASS y solo en `LUMIA-VQ03-QA`:
- Probar por voz «Lumi, explícame en dos frases qué es un avatar VRM». Si Whisper produce `un VRAM`, LUMIA debe **pedir aclaración**; si reconoce `VRM`, debe responder sobre el avatar directamente.
- Probar «Lumi, ¿cómo podrías mejorar tus animaciones para que se vean de manera más natural?» y anotar si Whisper escucha `esperan`. Si sucede, debe preguntar antes de responder sobre tiempos de espera.
- Probar «Lumi, ¿cómo podrías controlar mejor tus animaciones mientras conversamos?». Debe hablar de estados y transiciones, no prometer comandos sin confirmar.
- Repetir «¿Cuánta VRAM dedicada necesita una GPU para animaciones?». **VRAM hardware debe mantenerse hardware**.
- Anotar primer texto, primer audio, pausas `Kokoro/WAV`, y si se escuchó la voz real; evitar grabaciones privadas o información identificatoria.
- **No promover** VQ-03.4 a la carpeta original ni mover a MASTER por CI exclusivamente.

La instrumentación de vistas R8/VRM (`lumia:vq03-avatar`) sigue siendo un gate independiente para verificar ejecución visual, no sustituto del QA de voz.
