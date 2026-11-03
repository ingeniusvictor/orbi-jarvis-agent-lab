# PH-04.6 — Motion R8: duración real por clip y capacidades verificables

## Evidencia ASUS 3 noviembre 2026 · 13:17–13:20
Whisper capturó tres intentos iniciales que no coincidían con la gramática anterior, como «voy a hacer una demostración de tus animaciones» y «No alumnos, lo que quiero es que me des una demostración de tus animaciones». Qwen respondió que podía generar animaciones y videos cortos, función **no conectada** en LUMIA. Al encontrar la frase aceptada, la demo reprodujo un texto de 25 pasos como una única respuesta Kokoro; varios movimientos arrancaban muy seguidos, otros clips FBX terminaban antes de completar su ciclo. El usuario valoró positivamente la baja latencia **en conversación normal** y pide preservarla.

## Raíz
- PH-04.5 entregaba el guion de 25 frases a un solo speaker; el motor TTS consumía los fragmentos al ritmo de voz, no según los tiempos del FBX.
- PH-04 tenía `manualUntil = elapsed + 7.5` para cualquier gesto, incluyendo demonstraciones con FBX que pueden durar más.
- `THREE.LoopOnce` ignoraba `repetitions: 2` del saludo y `repetitions: 3` del aplauso.
- `Talking.fbx` se detenía al terminar la voz, aunque su ciclo corporal siguiera pendiente.
- Qwen no cuenta con una herramienta de video generativo conectada; ver imágenes e interpretar texto no equivale a renderizar videos nuevos.

## PH-04.6 implementado
- **Etapas audiovisuales independientes:** un solo guion de texto en el registro, pero 25 locuciones secuenciales con el mismo proveedor TTS local ya existente. Cada etapa usa su propio speaker descartable, nunca un segundo servicio o modelo.
- El **inicio audible** de la etapa solicita la animación. Al terminar de hablar, la boca vuelve al reposo, pero **el motor corporal continúa** hasta que Three.js emite `finished` o completa 1–2 ciclos reales para FBX con bucle infinito.
- Respeta la duración `AnimationClip.duration` devuelta por FBXLoader y las repeticiones del catálogo. Saludar = 2 ciclos, aplaudir = 3. Los clips en bucle muestran un ciclo si es largo o dos si el ciclo dura menos de tres segundos.
- El siguiente paso espera **ambas condiciones**: locución terminada y animación terminada. Después deja una pausa visible corta (850 ms corporal; 1400 ms facial); solo afecta al tutorial, no a la conversación.
- Hay un watchdog por bloqueo/falla de carga del archivo que permite continuar sin eternizarse. Una falla de FBX se registra como falla, no éxito.
- Mantiene `Detener`, barge-in, restitución de la vista original, gestos automáticos habituales y el respaldo procedural.
- Revisión de órdenes reales de Whisper, correcciones habladas y preguntas sobre habilidades. Se informa explícitamente que el programa **reproduce 17 FBX locales** y expresiones del VRM; no genera videos nuevos ni nuevas animaciones con Qwen3.5-2B por sí solo.

## Protección de datos y desempeño
- Modelos VRM y clips FBX permanecen exclusivamente en ASUS.
- No toca puerto, modelo Ollama, Whisper, proveedor Kokoro, registros de voz, la latencia normal de RC-04 ni la configuración de micrófono.
- `main` protegida. Cambios aislados sobre PH-04.5, PR borrador hasta QA visual.

## Criterios de aceptación en ASUS
1. Verificar respuesta a las frases exactas del diagnóstico 13:17/13:18/13:19.
2. Abrir LUMIA en solo rostro; pedir demo y confirmar cambio a cuerpo completo.
3. Saludo debe realizar sus **2 ciclos reales**, aplauso sus **3**; no deben cortarse por el antiguo límite de 7,5 segundos.
4. Para cada movimiento, la siguiente locución empieza cuando finaliza el clip actual; verificar el estado de progreso.
5. Los clips Talking/Idle/Listening/Walking (bucles) deben tener un ciclo visible completo, no ejecutarse indefinidamente.
6. En expresiones faciales, verificar presets con sincronización labial, con una pausa después de cada descripción.
7. Probar **Detener** y cualquier nueva intervención para confirmar cancelación, no retrasos residuales y retorno a la vista previa.
8. Comparar saludo cotidiano normal con versión anterior: los tiempos de respuesta de la conversación ordinaria deben mantenerse.
9. Cualquier clip incompatible o faltante debe avisarse en el registro de consola y continuar en modo seguro; verificar retarget sobre VRM0 real.
