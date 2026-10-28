# LUMIA VA-01 — Kokoro resident y ajuste óptico de Windows

## Problema observado

En captura TL-01 del propietario, una respuesta tardó 19,74 s en
producir el primer texto, 29,30 s hasta el primer inicio de reproducción
y 48,78 s hasta completar el turno. La pausa entre «Hola» y el resto
se reportó de aproximadamente diez segundos. El registro TL-01 actual
mide solamente el primer inicio de reproducción; para confirmar dónde
se produce la pausa añadimos marcas de tiempo por frase.

## Causa probable

El adaptador local existente (`bridge/orbia/local-tts.mjs` +
`bridge/runtime/kokoro/synthesize.py`) ejecuta Python desde cero para
CADA frase. Cada proceso construye otra vez `Kokoro(model, voices)`,
aunque acaba de hablar la primera oración. Esto puede producir esperas
largas entre frases, independientemente de la latencia de Ollama.

La nueva implementación proporciona un *piloto opt-in*:
`ORBIA_KOKORO_RESIDENT_ENABLED=1`.

- Se lanza un único Python local mediante stdio, sin nuevos puertos.
- Un único objeto `Kokoro` mantiene cargado el modelo ONNX durante
  la sesión; la fonetización española también se inicializa una vez.
- Un segundo opt-in \`VITE_LUMIA_TTS_PREFETCH_NEXT=1\` adelanta la
  generación de la siguiente frase mientras suena la primera; antes
  las frases añadidas durante la reproducción NO se pre-sintetizaban
  hasta que terminaba el audio anterior. Solo anticipa una frase.
- Las frases se procesan serializadas en una cola FIFO acotada
  (evita ejecutar dos inferencias sobre un mismo modelo a la vez).
- El motor comienza a calentarse al iniciar el bridge, en paralelo
  a la preparación del cerebro.
- Si se bloquea, falla o supera su tiempo de espera, se cierra el
  worker y se recurre al adaptador Kokoro anterior de una sola frase.
- No hay grabaciones persistentes, red externa ni consumo de API
  pagada. El audio temporal WAV se elimina tras su lectura.

**No se presupone una mejora numérica.** Kokoro puede seguir tardando
por rendimiento de CPU/ONNX en el equipo del propietario; la
certificación CI no ejecuta el modelo y la comparación A/B debe
medirse en Windows.

## Instrumentación de latencia

- Cada inicio real de reproducción de frase (audio.onplaying o
  speechSynthesis.onstart) se anota en la columna RESPUESTA como
  `Voz #1, Voz #2` con horas `HH:mm:ss.SSS`.
- Desde la segunda frase se muestra `pausa X.XX s` desde que terminó
  el segmento anterior hasta el inicio del siguiente.
- Las mismas marcas quedan en `COPIAR REGISTRO`.
- En diagnósticos D: última síntesis Kokoro (medida en servidor),
  número de frases, última pausa audible y pausa máxima.
- El registro no confunde tiempo de generación de modelo, espera del
  primer audio y pausa entre frases.

## Recuperar el avatar local aprobado

El propietario está usando dos carpetas de Windows:

- Original: `C:\ORBI CODEX\orbi-jarvis-agent-lab`.
- Experimental: `C:\ORBI CODEX\orbi-jarvis-agent-lab-TL01`.

La carpeta original tiene `src/scene/LumiaAvatar.tsx` **modificado**
por el instalador visual, sin comitear. La carpeta experimental se
creó con `git worktree`, cuya versión AV-01B puede no reproducir
exactamente ese último encuadre óptico. El GLB sí se había copiado.

No debe modificarse el modelo GLB, realizar git reset --hard ni fusionar
una corrección visual especulativa. Solución local reversible:
respaldar el componente de la instalación experimental, copiar el
componente local aprobado de la original a la experimental y ejecutar
`npm run build` para asegurar compatibilidad; revertir el respaldo si
fallan las pruebas. Registrar el diff para integración posterior.

## Activación y vuelta atrás

Solo después de actualizar el código experimental al nuevo branch:

- Sin opt-in: `$env:ORBIA_KOKORO_RESIDENT_ENABLED='0'` mantiene la
  generación estándar de Kokoro.
- Con opt-in: `$env:ORBIA_KOKORO_RESIDENT_ENABLED='1'` activa el worker.
- Es necesario conservar las rutas `ORBI_LOCAL_TTS_PYTHON`,
  `ORBI_LOCAL_TTS_MODEL` y `ORBI_LOCAL_TTS_VOICES` del runtime
  **original**. El residente siempre carga el nuevo `resident.py`
  desde este checkout experimental, incluso si el adaptador de una
  sola frase apunta al checkout original.
- Para volver atrás: detener el bridge y reiniciar con variable 0.

La rama protegida `main` y el acceso directo original no cambian.


## ASUS TUF — primera medición física con Kokoro residente (28-oct-2026)

Evidencia: captura de LUMIA en Chrome entregada por propietario después de
instalar Whisper.cpp y Kokoro local, ejecutar `npm run start:lumia` con
`ORBIA_KOKORO_RESIDENT_ENABLED=1`, y comprobar el puente `/health`.

Entorno: ASUS TUF i5-10300H / 32 GB / GTX 1650 Ti 4 GB;
Ollama 0.40.12; `qwen3.5:2b-q4_K_M` en **100 % GPU**, contexto 4096;
`effectiveStt=local`, `effectiveTts=local`, `voiceProfile=lumia-kokoro`;
`sttAvailable=true`, `ttsAvailable=true`. La interfaz muestra ahora
«L.U.M.I.A. · Kokoro local» tras sincronizar HUD después del probe VRM
(commit `447d310`). Estas pruebas certifican selección y ejecución real,
pero no evalúan el contenido de cada archivo de audio ni benchmark de
fluidez reproducido múltiples veces.

Mediciones visibles en pantalla:
- Saludo inicial: primer texto a **+1,96 s**, primer audio a **+5,24 s**,
  pausa entre frases **1,13 s**, Kokoro **1,12 s**, total **13,94 s**.
- Pregunta sobre IA local: Whisper STT de la frase final **4644 ms**
  (otra transcripción parcial **3588 ms**); primer texto **+2,83 s**,
  primer audio **+9,01 s**, segunda frase **pausa 4,69 s**, atribución
  **texto 0,00 s / Kokoro 4,68 s**.
- Una captura anterior sin residente registró **pausa 8,15 s**; la
  diferencia 8,15 → 1,13 s de las introducciones es prometedora, pero
  **NO es un A/B controlado de frases iguales**.

Hallazgos cualitativos:
- Se conserva el rostro AV-01B sin deformaciones graves visibles;
  botón «VISIÓN · FOTO» expuesto (todavía sin prueba de integración).
- La transcripción de «IA local» apareció como un término semejante a
  «hiálocal»: error de STT a investigar en audio con consentimiento.
- Aunque pidió «en cuatro frases», el modelo generó visualmente dos
  oraciones. Analizar límite de tokens y adherencia a instrucciones por
  separado de la latencia de voz.
- En el turno largo la pausa se explica principalmente por la síntesis
  Kokoro (4,68 s), no espera por texto (0,00 s).

**Próximo experimento aislado**: cambiar únicamente
`VITE_LUMIA_TTS_PREFETCH_NEXT=1` antes de iniciar Vite/LUMIA y mantener
`ORBIA_KOKORO_RESIDENT_ENABLED=1`; repetir una solicitud igual con
registros «COPIAR REGISTRO» y diagnóstico D. Esta bandera ya existe en
`src/lib/tts.ts`. Se espera evaluar si preparar la siguiente frase en
paralelo con la reproducción reduce el tiempo de silencio; **no
garantizar aceleración** por modelo ONNX ni afectar el código GLB. Revertir
desactivando bandera y reiniciando si hay errores de audio. No activar
herramientas de escritura, APIs pagas ni exposición remota durante pruebas.
