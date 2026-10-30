# LUMIA WR-01 — Recuperación de pregunta tras volver a espera

## Evidencia observada el 28 de octubre

- Primer comando aceptado a las 01:03:55.167 y respuesta de texto correcta.
- Primera frase de modelo: +2,42 s; primer audio: +10,17 s;
  fin del turno de Ollama: 29,69 s.
- A las 01:04:46.541 Whisper reconoció una nueva frase que empezó por
  «Lumi, actualmente tienes varias IA local con las cuales se pueden
  intercambiar. Me puede decir, ¿cuáles son?».
- La frase quedó en el carril ESCUCHANDO. No aparece una segunda entrada
  COMANDO A O.R.B.I.A. y la pantalla pasó a «EN ESPERA — DI LUMI».

La evidencia NO demuestra que `qwen3:1.7b` fallara ante complejidad,
pues aparentemente esa frase nunca llegó al LLM. Tampoco permite
demostrar qué `capturedMode` tenía el segmento: es una hipótesis de
transición de fase que debemos certificar en la instalación Windows.

## Causa probable y protección

La máquina de estados permite la siguiente carrera:
1. El VAD empieza a grabar cuando el modo es `guard` porque LUMIA
   todavía está hablando/terminando de hablar.
2. Whisper tarda varios segundos y el frontend cambia a `dormant`
   / `wake` por el timeout del diálogo.
3. La ruta de `transcribe()` para segmentos etiquetados `guard`
   activa `h.onSpeechStart()` y luego `h.onUtterance(trailing)`.
4. `App.onUtterance` rechaza expresamente las preguntas recibidas
   en fase `dormant`, por lo que una solicitud reconocida con «Lumi»
   se descarta sin generar evento de error ni comando.

WR-01 comprueba el modo ACTUAL cuando se procesa un transcript GUARD.
Solo cuando el texto incluye **nombre explícito de LUMIA más
instrucción** y la fase actual es WAKE, pasa por `h.onWake(trailing)`
con el debounce existente. De este modo el asistente vuelve a abrir
correctamente el turno. No puede reabrir la sesión por música de fondo,
una voz de TV sin nombre, cancelaciones sin wake ni por nombre aislado.
Los filtros de autoeco y Whisper noise permanecen anteriores y activos.

Además, se marca en `ESCUCHANDO` la coincidencia de wake aun cuando el
audio se había capturado como GUARD, facilitando diagnóstico.

## Inventario conversacional

La formulación de la captura menciona «varias IA local», «intercambiar»
y termina preguntando «¿cuáles son?». MI-02 no la identificaba porque
faltaba la palabra `modelos`. WR-01 admite esa combinación muy
específica como consulta al inventario real de Ollama, sin conjeturas
del modelo. También reconoce «¿cuáles son?» aislado solo si el
historial reciente ya trataba el inventario local.

## Qué NO se ha cambiado

- Ni `main`, ni la instalación original de LUMIA, ni atajos Windows.
- Ni el avatar aprobado, GLB, luz, escala, ni cámara.
- Ni la política de seguridad, activación por nombre o aislamiento
  de conversaciones domésticas.
- Ni Whisper persistente, ni TTS/nuevos proveedores, ni modelo activo.
- No se promete tiempo mejorado en preguntas generales.

## Validación siguiente

En Ryzen TL-01, preservar el ajuste visual local antes de cambiar de
rama. Verificar en la copia experimental:
1. Primera pregunta «Lumi, explícame cómo funciona una IA local».
2. Cuando responda, pregunta «Lumi, actualmente tienes varios modelos
   de IA local instalados. ¿Cuáles son?»; confirmar que aparezca
   COMANDO A O.R.B.I.A. y el inventario real de Ollama.
3. Repetir la segunda pregunta poco después de la respuesta, en el
   borde del retorno al modo dormido. No debe perderse en ESCUCHANDO.
4. Probar «[Música]», conversación externa sin nombre, «Lumi» aislado
   mientras el asistente está hablando y la interrupción «Lumi,
   detente» para preservar protección frente a falsos despertares.
5. Pulsar COPIAR REGISTRO para capturar modo, STT, primer texto, primera
   frase de voz y pausas; confirmar la voz efectiva en /health.

Si la pregunta sigue sin entrar, los datos de captura/estado permitirán
distinguir si la causa real es un falso autoeco, un debounce, un
cambio de `captureEpoch` o una clasificación `nonSpeech`.
