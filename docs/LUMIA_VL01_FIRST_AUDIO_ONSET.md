# L.U.M.I.A. VL-01 — Primera voz más rápida, sin cambiar el Voice Gate

Rama: feature/lumia-voice-first-audio-v1
Base canónica: feature/lumia-voice-gate-v1
Estado: implementación de código en PR aislada; certificación real de latencia en Windows pendiente.

## Diagnóstico

El ciclo actual de LUMIA depende de STT (SpeechRecognition o Whisper) →
LLM → texto fragmentado → TTS (voz del sistema/Kokoro/ElevenLabs).
La salida de texto ya era incremental, pero para escuchar algo normalmente
era necesario recibir una oración completa (o llegar al límite de 220
caracteres sin puntuación). Eso retrasa innecesariamente el inicio
perceptible de respuestas con introducciones largas.

Por otro lado, el reconocimiento de navegador usa un silencio de 1200 ms,
más el ensamblado de 300 ms para frases completas; el VAD local usa 650 ms.
Estos tiempos NO se cambian en VL-01: bajarlos sin evidencia puede fragmentar
preguntas y causar errores de detección de voz/eco.

## Implementado

- Nuevo algoritmo puro de primera frase: src/lib/first-audio-chunk.ts.
- La PR conserva el corte prioritario por puntuación de fin de oración.
- Para la primera frase, prefiere una pausa real (coma, punto y coma,
  dos puntos, raya o salto de línea) después de al menos 52 caracteres.
- Si la respuesta no tiene una pausa natural, solo realiza un corte
  prudente por espacio a partir de 148 caracteres acumulados.
- Solo el primer fragmento usa esta optimización; los demás conservan
  la lógica original y el máximo de 220 caracteres.
- La cola, el barge-in, la cancelación, los perfiles, el orden y los
  fallbacks de TTS se mantienen.
- La interfaz Diagnostics (tecla D) incorpora dos métricas por última
  respuesta: "first model text" y "first audible word", en milisegundos
  desde el inicio del procesamiento de la consulta ya transcrita.
- El inicio audible proviene de eventos reales SpeechSynthesis.onstart
  o HTMLAudioElement.onplaying, no de recibir texto ni de pedir síntesis.
- No se guardan transcripciones ni muestras de voz en estas métricas.

## Validación

    npx tsx scripts/certify-first-audio-chunk.ts
    npm run certify:brain
    npm run certify:voice-gate
    npm run build
    npm run lint

Esta certificación cubre integridad del texto, cortes entre palabras,
salidas breves, puntuación de pausa y flujo gradual. No mide reproducción
física ni promete respuesta por debajo de un segundo.

El PR Gate de la rama canónica ejecuta el test nuevo y los certificados
previos antes de permitir una fusión.

## Pruebas en PC Windows

1. Iniciar LUMIA con el perfil habitual sin cambiar preferencias.
2. Abrir Diagnostics con la tecla D.
3. Hacer varias preguntas sin herramientas, otras con consultas y otras
   con respuestas largas, tanto con navegador como con Whisper local.
4. Registrar al menos 10 mediciones por configuración, y comparar
   medianas y percentil 95 de "first audible word".
5. Revisar interrupciones, repeticiones, eco y cortes a mitad de palabra.
6. No activar una configuración más agresiva mientras no mejore latencia
   sin degradar fidelidad o seguridad.

## Lo que sigue pendiente para una conversación comparable a Grok Voice

VL-02: instrumentar latencia de captura y transcripción separada de la
latencia del primer token y la voz.

VL-03: detectar finales de turno de forma adaptativa por voz/texto, sin
recortar pausas humanas; certificar Whisper y navegador por separado.

VL-04: síntesis y reproducción verdaderamente por streaming para no
esperar a descargar todo el WAV/MP3, conservando fallback seguro.

VL-05: backend opcional realtime speech-to-speech con audio bidireccional,
gestión robusta de interrupciones, controles de coste y privacidad; integrar
solo bajo confirmación y sin reemplazar el modo local-first.

**VL-01 reduce una fuente de espera, pero no es aún full-duplex, ni valida
una latencia comparable a Grok en un equipo físico.**
