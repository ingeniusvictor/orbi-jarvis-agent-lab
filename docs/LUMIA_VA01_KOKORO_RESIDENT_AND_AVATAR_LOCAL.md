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
