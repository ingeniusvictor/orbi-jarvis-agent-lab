# RC-01 — IA local en Whisper y primera respuesta progresiva en Ollama

## Evidencia de Windows

En la captura del 27 de octubre se ve que la voz Kokoro residente ya
reduce las pausas entre frases a algunas décimas de segundo, pero
Ollama `orbia-lumia:4b` tarda más de 37 segundos en emitir el primer
texto de una pregunta. Whisper.cpp `ggml-base.bin` tarda 2,3–5,5 s en
reconocer segmentos y transcribe la expresión `IA local` como
`una y local`, produciendo preguntas mal interpretadas.

## Qué hace RC-01

1. Whisper: agrega al pequeño vocabulario de contexto de comando
   `IA local` e `inteligencia artificial local`, sin repetir wake
   words adicionales. Corrige únicamente la variante literal
   `una y local` cuando aparece en una frase con intención técnica
   contextual (trabajar, configurar, aprender, usar, modelo, etc.).
   Frases aisladas `A lo local`, `E-A` y lenguaje común no se cambian.
   Los segmentos descartados de música se siguen descartando.
2. Ollama: conserva el modo anterior que solicita un único JSON
   validado mediante `format`/esquema y `think:false` con
   `stream:false`. Con opt-in
   `ORBIA_OLLAMA_VOICE_STREAM=1`, pide a Ollama
   `stream:true` con el MISMO esquema. Un parser cerrado solo
   deja pasar fragmentos dentro de la cadena JSON `respuesta`,
   ya decodificada y con cortes en palabras. Los otros campos,
   Markdown y el razonamiento no se reenvían al HUD ni TTS.
   Si el flujo no llega a producir texto, vuelve al método
   anterior. Si ya comenzó a emitir fragmentos y falla, no
   repite la respuesta (evita frases duplicadas).
3. Diagnostics: El backend ya registra por turno
   `total_duration`, `prompt_eval_duration`, `eval_duration`,
   `eval_count` y tokens/s de Ollama. En streaming añade también
   el tiempo observado entre envío y final, sin almacenar preguntas
   ni secretos nuevos en los logs.

## Lo que NO garantiza

- No se asegura que un modelo local en CPU alcance velocidad de Grok:
  la capacidad, cuantización, carga simultánea y aceleración GPU
  requieren medidas físicas con `ollama ps` y latencias reales.
- El modo de respuesta progresiva expone contenido antes de que el
  JSON final esté completamente validado. Por eso es experimental,
  desactivado por defecto y recomendado solo para pruebas de voz
  de un único propietario con contenido no sensible.
- Si la transcripción es incorrecta de otra forma, no se inventa
  la intención; preferir confirmación explícita a un falso comando.
- No habilita WebRTC, nube de pago, herramientas destructivas,
  whisper-server ni escritura de archivos.
- No modifica `LumiaAvatar.tsx` ni el GLB instalado.

## Prueba A/B en Windows

La carpeta de ensayo existente es:
`C:\ORBI CODEX\orbi-jarvis-agent-lab-TL01`

El archivo del avatar en TL-01 tiene correcciones locales aprobadas
por el propietario, por lo que NO debe usarse `git switch` a la fuerza
ni un `git reset --hard`. Antes de pasar a RC-01 es preferible
guardar un respaldo del avatar, aplicar un `git stash push`
limitado a `src/scene/LumiaAvatar.tsx`, cambiar el worktree
al commit RC-01, restaurar el componente desde el respaldo
y compilar. El GLB es local, no versionado.

A/B 1: `ORBIA_OLLAMA_VOICE_STREAM=0`, esperar respuesta y
pulsar `COPIAR REGISTRO`. A/B 2: reiniciar el bridge con
`ORBIA_OLLAMA_VOICE_STREAM=1` y repetir la misma pregunta.
Comparar `primer texto` y `primer audio`, no solo duración
total. Para diagnóstico de CPU/GPU y velocidad real del modelo,
usar `ollama ps` y el log `[orbia] LUMIA ... latency`.

El modo de prueba debe seguir usando
`ORBIA_KOKORO_RESIDENT_ENABLED=1` y
`VITE_LUMIA_TTS_PREFETCH_NEXT=1` que dieron buenos resultados.
La variable de Vite se lee al arrancar el servidor web.

El sistema original y el acceso directo del escritorio permanecen
sin cambios.
