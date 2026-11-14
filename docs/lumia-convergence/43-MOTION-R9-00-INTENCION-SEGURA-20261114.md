# L.U.M.I.A. Motion R9-00 — contrato de intención expresiva

**Corte:** 14-11-2026. **Base probada de ASUS:** 1580a5182eba540893e35e37065be77da4ed014c.

## Alcance CERTIFICADO / NO CERTIFICADO

Se añade únicamente un contrato seguro de intenciones y 17 pruebas sintéticas Node. NO está conectado a Qwen, Ollama, App.tsx, Kokoro, Three.js, VRM ni al Body Companion R8. **No es una mejora visual instalable todavía.** No hay nuevas dependencias, FBX ni VRM publicados. Se conserva la compilación previa. No tocar main ni los lanzadores ASUS.

El código actual ya contiene body-motion-core (procedural y límites), body-presence (respiración), semantic-motion (gestos sincronizados al texto hablado), motion-intelligence (selección y precedencias), portal-body-companion (FBX/fallback) y vrm0-head (rig VRM0 raw). Evitar duplicaciones o migrar ciegamente a normalized bones.

## API experimental

El clasificador proporciona solamente:
- version=1
- emotion: neutral, focused, happy, concern, curious, calm, surprised
- intensity: número 0..1
- gesture: none, explain, affirm, deny, greet, comfort, celebrate, think
- gaze: user, cursor, away
- posture: neutral, attentive, relaxed
- duration_ms: entero 250..4000

Quedan prohibidos ángulos, huesos arbitrarios, rutas de clips, acciones sobre el PC, comandos externos y valores ajenos al esquema. El runtime rechazará cualquier respuesta inválida incluso si es JSON. sessionId/turnId los fija la aplicación, nunca el LLM.

La intención llega como canal lateral, sin sustituir ni retrasar el streaming de texto/TTS. R9IntentController espera el verdadero onFirstAudioStart/onplaying, valida sessionId/turnId, se detiene al vencer TTL, rechaza señales tardías y cede prioridad ante clip manual, demo guiada, baile o interrupción. Si el clasificador falla, el fallback es el R8 actual, no un modelo en T-pose.

## Hallazgos sobre repositorios externos

- pixiv/three-vrm: huesos normalizados y expresiones. El portal presente usa adaptador VRM0 RAW; requiere auditoría antes de migrar.
- timesbye/OPEN-AVATAR: motor Unity/UniVRM, no Three.js.
- nirholas/three.ws: referencia útil de mezcla facial/emocional, no es necesario instalar el SDK entero.
- CarterPerez-dev/angelamos-3d: React/Three.js/Ollama, con licencia AGPL-3.0; no copiar fuentes en ORBI MIT sin resolver obligaciones.
- ameagaru12-gif/lacuna_core: estado emocional continuo y memoria simple (MIT); las funciones avanzadas listadas pertenecen a una versión propietaria.
- NOBI327/amygdala: memoria con SQLite, etiquetas y recuperación emocional (MIT); nomic-embed-text sería ampliación propia, no requisito demostrado por su README.
- Ollama: el parámetro format permite un JSON Schema; aun así, validar siempre. En GTX 1650 Ti 4GB, NO asumir VRAM sobrante ni añadir otra inferencia por respuesta sin benchmark.

## Privacidad de la fase de memoria

No habilitar registro continuo, almacenamiento automático de transcripciones, biometría ni datos de menores. Memorias seleccionables y con procedencia, revisión, exportación y borrado. No inferir emociones íntimas como hechos. El olvido nunca debe borrar preferencias importantes sin control del propietario.

## Pruebas y próximo gate

Ejecutar: node scripts/certify-lumia-motion-r9-contract.mjs

17/17 PASS en Node 22 en laboratorio independiente, para validación de contrato y temporización lógica. **No se ha ejecutado QA gráfica ASUS ni una prueba de integración completa en GitHub Actions.**

Siguiente paso R9-01: consumir intenciones de manera opt-in y solo con telemetría, correlacionando el evento REAL de audio y las prioridades actuales de PH-04.8. R9-02: traducir a SemanticMotionCore/BodyPresenceCore con compositor aditivo y protección de articulaciones. R9-03: calibrar mirada/manos/IK en asset real. R9-04: memoria local con controles de privacidad y benchmarks separados.

No fusionar automáticamente a main. Mantener la rama como experimento hasta QA física.


## R9-01 / R9-02 — avance experimental PR #84

Implementado en rama, no validado visualmente en ASUS:

- spoken-director.js: clasifica frases realmente pronunciadas por Kokoro, de forma local y determinista, sin segunda inferencia.
- expressive-blend.js: suma pequeñas rotaciones a cabeza, brazos, manos y pecho. No permite huesos arbitrarios; amplitudes maximas de 0.055 rad en los brazos y 0.050 rad en la cabeza.
- portal-body-companion.ts: usa los módulos existentes de R8, aplica R9 después de las guardas R8 y cede prioridad a manuales, tutoriales y demás FBX.
- LumiaPortalHead.tsx: reusa eventos de audio real del Portal; conserva visemas, parpadeo, demo y preset facial si existe.
- scripts/certify-lumia-motion-r9-director.mjs: pruebas sintéticas.
- .github/workflows/lumia-motion-r9-spoken-expressivity.yml: regresiones R9, R8, build y lint.

CONTROL REVERSIBLE: R9 apagado por defecto. En el visor con parámetros de URL, agregar lumiaR9=1. Ejemplo: ?lumiaAvatar=bust-vrm&lumiaR9=1. Rollback: ?lumiaAvatar=bust-vrm&lumiaR9=0. R9 sólo se representa en busto/cuerpo completo. No altera lanzadores, Ollama, Whisper ni Kokoro.

QA física ASUS requerida:
1. Comprobar R8 con lumiaR9=0, voz/labios/ojos, tres vistas, 17 FBX y caminata PH-04.8.
2. Activar busto y lumiaR9=1. Pedir: «Primero, explica qué es un string fotovoltaico» o «Por ejemplo, cómo funciona un inversor». Observar microgestos sin deformar.
3. Pedir felicitar, negar y explicar; inspeccionar el retarget, ojos, mandíbula y voz.
4. Activar el gesto manual de aplauso y la demostración: R9 no debe superponer movimientos.
5. Interrumpir con voz, cambiar de vista, reanudar: ningún gesto de conversación anterior debe persistir.
6. Medir estabilidad GPU y ausencia de pausas extra de Kokoro.

IMPORTANTE: esta versión aún no conecta respuestas JSON de Qwen al controlador ni implementa IK. No incluye memoria Lacuna/Amygdala. Las pruebas de código no certifican la apariencia real del VRM; este gate se mantiene pendiente.
