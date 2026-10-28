# LUMIA ASUS — perfil de conversación rápida y centrado de rostro (2026-10-28)

## Por qué el modo actual aún no se siente como Grok conversacional

El modo actual es secuencial: captura de voz/VAD -> Whisper.cpp
local -> ensamblado del comando -> Ollama 2B -> generación de frase ->
Kokoro local ONNX -> reproducción -> guardia antieco. No es
speech-to-speech nativo ni full-duplex. Las optimizaciones no garantizan
una conversación subsegundo.

**Hardware y resultados aportados por el propietario:**
- ASUS TUF i5-10300H, 32 GB RAM, GTX 1650 Ti 4 GB.
- Ollama 0.40.12, `qwen3.5:2b-q4_K_M`, 100 % GPU a contexto 4096.
- Voz local: `effectiveStt=local`, `effectiveTts=local`,
  `voiceProfile=lumia-kokoro`, ambos runtimes READY.
- Ejemplo con Kokoro residente (captura 2026-10-28):
  STT comando ~4644 ms, primer texto +2,83 s,
  primera voz +9,01 s, pausa siguiente ~4,69 s;
  atribución espera de texto 0,00 s, síntesis Kokoro 4,68 s.
- Es una muestra individual, no mediana representativa; el micrófono y
  la escucha subjetiva todavía requieren validación continuada.

## Estado recuperado VL-01 a VL-06

Las etapas no fueron descartadas ni reemplazadas; forman parte de la
consolidación de `feature/lumia-consolidated-release-20261028`.

| Etapa | Qué aporta | Condición actual |
| --- | --- | --- |
| VL-01 | Primer fragmento de voz a partir de una pausa natural; medidor de primera voz | Integrada en código |
| VL-02 | STT/ensamblado por separado; guardia posvoz más corta | Integrada; guardia corta es opt-in |
| VL-03 | Detección adaptativa de final de turno y reconocimientos breves | Integrada; desactivada por defecto |
| VL-04 | Streaming progresivo MP3 de ElevenLabs en navegador | Integrada; no acelera Kokoro local |
| VL-05 | Piloto WebRTC bidireccional de audio Realtime mediante API OpenAI | Integrada; requiere consentimiento, API y facturación aparte, sin herramientas |
| VL-05B | Aislamiento del piloto, límites de sesiones, cierre y PIN | Integrada; piloto sin activar |
| VL-06 | Medidor acústico, preflight y aceptación Windows | Integrada; requiere pruebas físicas |

**No confundir:** las fases antiguas del ORBI SOLAR ASSISTANT
(V1 interfaz, V2 documentos/PDF, V3 RAG PMGD, V4 micrófono,
V5 imágenes, V6 SCADA/Softwrench) son otra hoja de ruta.
La presencia de VL-01..VL-06 no demuestra que esas capacidades
de industria solar estén implementadas.

## Perfil piloto ASUS con cambios reversibles

Lanzador: `INICIAR_LUMIA_ASUS_RAPIDA.cmd` en la raíz del repositorio.

1. Mantiene Ollama 2B 100 % GPU, Whisper CLI estable,
   Kokoro local, avatar y control de permisos sin escritura.
2. Activa `ORBIA_KOKORO_RESIDENT_ENABLED=1`, modelo de voz cargado,
   y `VITE_LUMIA_TTS_PREFETCH_NEXT=1`, precarga solo la frase siguiente.
3. **No activa** `ORBIA_WHISPER_SERVER_ENABLED`. El adaptador
   `bridge/orbia/local-stt.mjs` documenta falsos despertares y
   transcripciones de ruido de fondo en pruebas previas con servidor.
   Evaluarlo más adelante de forma aislada y con control de alucinaciones.
4. Aplica `VITE_LUMIA_FACE_SHIFT_PX=0` solo en este proceso ASUS.
   Sin override, el AV-01B conserva su calibración canónica `+25 px`.
   La corrección solo afecta el perfil `face-v1`, no el antiguo robot,
   las texturas ni el GLB. Acepta valores finitos entre -80 y +80.
5. Mantiene apagados VL-03, VL-04, VITE_LUMIA_FAST_LOCAL_FOLLOWUP
   y la API Realtime para comparar una variable de latencia cada vez.
6. Sigue expuesta la visión VI-01 únicamente por elección manual de
   imagen y con modelo Qwen3.5 2B; no se habilitan capturas automáticas.

La corrección de centrado en pantalla es un **ensayo visual**, no
calibración física aprobada aún. Si sigue a la izquierda/derecha, el
propietario puede ajustar solo el valor de
`VITE_LUMIA_FACE_SHIFT_PX` al iniciar Vite, sin cambiar el GLB.

## Validación física, mediciones y reversión

- Antes de cambiar el perfil, finalizar cualquier bridge anterior
  (puerto 8787) y esperar que libere también Vite (5173).
- Guardar resultado con `COPIAR REGISTRO` en la interfaz,
  diagnósticos D y captura mostrando borde del reactor y rostro.
- Preguntas iguales en cada modo; al menos 10 respuestas cortas y
  10 turnos con varias frases por configuración. Registrar:
  tiempo desde fin real de voz a envío, STT, primera salida LLM,
  primer audio audible, pausa por frase, `lastGapWaitingAudioMs`,
  cortes/omisiones y ecos. Separar longitud de respuesta y carga.
- No afirmar que Grok y LUMIA están comparados bajo el mismo hardware,
  mismo modelo o misma arquitectura.
- Para volver al encuadre aprobado antiguo: iniciar sin
  `VITE_LUMIA_FACE_SHIFT_PX` o establecer 25.
- Para volver al audio antiguo: poner
  `ORBIA_KOKORO_RESIDENT_ENABLED=0` y
  `VITE_LUMIA_TTS_PREFETCH_NEXT=0` y reiniciar.
- No habilitar herramientas sensibles, API de pago ni acceso remoto
  para comparar latencias.

**Limitaciones externas:** `npm audit --omit=dev` en esta ASUS detectó
12 vulnerabilidades, incluidas dos críticas, en la cadena de dependencias;
no habilitar acceso de red externa ni escrituras hasta auditoría y
actualización validadas. Cambios solo en PR #28, `main` protegido.


## Incidente ASUS: la conversación pasa a FONDO tras la respuesta (captura 18:42)

El propietario observó un turno completado y luego dos nuevos mensajes
entendidos en la columna ESCUCHANDO pero no respondidos:

- 15:40:58, COMMAND: «Pícame cómo funciona una IA local» (error de
  dictado probable de «Explícame...»).
- 15:41:25, respuesta finalizada, total 27,55 segundos, primer audio
  +8,08 segundos. Audio #2 sin silencio perceptible: pausa 0,01 s.
- 15:41:39, FONDO: «El modelo de IA local me recomiendas para 4 gigas
  de Virran.» Probablemente refería 4 GB de VRAM. **No fue comando**.
- 15:42:05, FONDO: «¡Adiós!», tampoco comando.
- HUD: «EN ESPERA — DI 'LUMI'».

Diagnóstico: LUMIA **no estaba bloqueada**: había vuelto a
`dormant/wake`, y el speech sin palabra de activación queda en el
registro pero no se entrega al LLM. Después de una respuesta el código
deja una ventana de continuación de 11 s
(`FOLLOW_UP_MS`), precedida por un periodo antieco de 2600 ms; el
horario exacto depende de comienzo/fin reales y del momento en que
Whisper devuelve el segmento. Esto merece una medición de las
transiciones, pero **no se debe hacer que cualquier frase de fondo
despierte LUMIA** por seguridad y ruido doméstico.

Para probar inmediatamente, decir en un solo segmento:
«Lumi, ¿qué modelo local me recomiendas para cuatro gigabytes de VRAM?»
o usar Espacio para activar manualmente una pregunta.

ASR: `bridge/orbia/speech-vocabulary.mjs` ahora añade
`VRAM`, `GPU`, `memoria de video`, `Explícame` y
`recomiéndame` en el contexto técnico del modo COMMAND. Además
normaliza únicamente dos errores observados muy concretos:
«Pícame cómo funciona» al inicio de frase y
«4 gigas de Virran» cuando hay tamaño explícito.
Las frases parecidas en otros contextos permanecen intactas. Los
tests de adaptador comprueban los dos casos y que no se sustituyen
expresiones ordinarias.

Esto es una **corrección textual post-STT, no una mejora demostrada
del audio de Whisper**. La próxima prueba debe registrar los segmentos
crudos, proveedor, STT tiempo y el resultado del comando; si continúa
siendo errático, considerar A/B del modelo Whisper multilingual small
con base, midiendo precisión y latencia. No cambiar modelo para todo
el sistema sin evidencia, ni habilitar servidor persistente que antes
produjo falsas activaciones. El perfil Grok-like necesitaría diseño
de seguimiento opt-in que no admita órdenes sensibles sin activación.
