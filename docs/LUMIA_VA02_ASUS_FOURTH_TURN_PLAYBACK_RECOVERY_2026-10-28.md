# LUMIA VA-02 — Fallo intermitente de continuidad tras varias preguntas

Fecha: 28 de octubre de 2026. PR #28 (sin fusionar a main).

## Hallazgos
En la prueba anterior LUMIA figuraba como **EN ESPERA — DI LUMI** tras haber completado la respuesta. Ese estado no es un bloqueo: la ventana de seguimiento dura 11 s desde la salida de guardia antieco. La nueva observación (reactivada y perdida otra vez la continuidad) requiere comprobar si regresó a EN ESPERA o si quedó en RESPONDIENDO.

La auditoría detectó otra vulnerabilidad verificable: un WAV local preparado y entregado a un Audio HTML podía quedar esperando el evento de inicio o fin indefinidamente, dejando `await speaker.end()` pendiente. No hay aún evidencia acústica que demuestre que este fue el fallo exacto de la cuarta pregunta.

## Mitigación ASUS, reversible
- Perfil ASUS solamente, con `VITE_LUMIA_LOCAL_PLAYBACK_RECOVERY=1`.
- Si un WAV de Kokoro local no inicia en 12 segundos, se libera y se intenta la voz de Windows para la frase. Si esa voz tampoco funciona, se informa el fallo sin llamar ElevenLabs de pago.
- Si ya empezó, pero el reloj de reproducción deja de avanzar durante 15 segundos, se finaliza esa frase para que pueda continuar la cola, **sin repetir texto que ya llegó a reproducirse**.
- Contadores en el panel D: timeouts de comienzo de WAV, bloqueos de reproducción y fallbacks offline.
- El fallo de inicio y la falta de progreso se distinguen de pausas deliberadas del modelo o esperas de Whisper.
- Sin modificaciones de GLB, tamaño canónico, permisos, micrófono, aros ni `main`.

## Prueba física
1. Después de actualizar, hacer ocho preguntas consecutivas.
2. Cuando deje de responder, **no reiniciar**: anotar el estado arriba a la derecha, pulsar D y copiar el registro con COPIAR REGISTRO.
3. Si dice EN ESPERA, pronunciar `Lumi` antes de la siguiente pregunta. Si dice RESPONDIENDO, revisar counters de WAV y errores. Si dice ESCUCHANDO, comprobar `last drop`, cola STT y `stale segments`.
4. Verificar que ningún WAV válido de más de 15 s sea interrumpido: el contador vigila **progreso de currentTime**, no duración total.
5. Para revertir, cambiar el lanzador a `set "VITE_LUMIA_LOCAL_PLAYBACK_RECOVERY=0"` y reiniciar.

La CI prueba contrato, compilación y lint. No reemplaza un ensayo con micrófono, auriculares y navegador Windows.
