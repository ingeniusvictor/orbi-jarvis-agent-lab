# LUMIA VL-05B — Auditoría de seguridad y preparación de prueba física

Repositorio: ingeniusvictor/orbi-jarvis-agent-lab
Base: feature/lumia-voice-webrtc-vl05 (PR #17)
Rama: feature/lumia-voice-vl05b-session-hardening
Estado: cambios en PR de laboratorio, sin despliegue ni uso de API.

## Hallazgos y correcciones

### H-01 — PIN sin límite de intentos

VL-05 exigía PIN, pero no limitaba los intentos fallidos.
VL-05B aplica cinco fallos consecutivos -> bloqueo de cinco minutos para
emitir credenciales temporales, incluso si se presenta después el PIN correcto.
Los orígenes que NO pertenecen a localhost ni siquiera llegan a verificación
de credenciales. Los errores no revelan si el PIN es correcto. No se guardan
PINs ni huellas de voz. Se añade a la petición del servidor el encabezado
OpenAI-Safety-Identifier pseudónimo, derivado por SHA-256 de un valor local
separado por un prefijo de aplicación: nunca se envía el PIN en claro a OpenAI.

**Limitación:** el bloqueo es por proceso; reiniciar el bridge lo reinicia.
No sustituye autenticación de sistema operativo ni aislamiento local.

### H-02 — Tiempo de establecimiento sin límite global

VL-05 tenía temporizador de 90 s DESPUÉS de negociar WebRTC: una conexión
sin respuesta antes del establecimiento podía quedar esperando y mantener
ocupado el micrófono.

VL-05B:
- comienza el plazo máximo de 90 segundos desde el inicio del intento
  de prueba, incluyendo permiso de micrófono, credencial y SDP;
- cierra los intentos que superan 20 segundos en la negociación;
- usa AbortController propio para las dos peticiones de red;
- al cancelar, aborta red, cierra canal de eventos, pista clonada de
  micrófono y RTCPeerConnection, y retira el elemento de reproducción.

**Limitación:** cerrar WebRTC en el navegador no constituye un tope absoluto
de gasto del proveedor. El propietario debe definir límites de facturación.

### H-03 — Cierre al perder red, audio o foco

VL-05B termina el piloto si el navegador rechaza la reproducción remota, si
la pestaña se oculta, al navegar fuera o al recibir cierre/fallo de WebRTC.
Admite 5 segundos de recuperación para una desconexión transitoria; si sigue
desconectado, cierra la prueba.

### H-04 — Recuperación doble de la voz normal

En VL-05 el cierre del cliente dispara un callback mientras el cierre
de la interfaz puede estar todavía en proceso. VL-05B introduce un
guardado de cierre reentrante y marca la voz original como recuperada antes
de abortar la sesión experimental. No se autoriza una segunda inicialización
de Whisper o SpeechRecognition desde callbacks anidados.

## Cambios que NO se han realizado

- NO se habilita Realtime de forma automática.
- NO se usa OPENAI_API_KEY ni ORBIA_REALTIME_OWNER_PIN en pruebas de CI.
- NO se agrega ninguna herramienta al modelo: tools=[], tool_choice=none.
- NO se habilitan pagos, escrituras, navegador, comandos del sistema ni MCP.
- NO se altera la configuración de Voice Gate, identificación del hablante,
  liveness, anti-replay ni la memoria del asistente.
- NO se presume que el modelo Realtime reconozca la voz registrada de LUMIA.
- NO se fusionan las PR #13–#17 sin revisión y certificación de hardware.

## Certificación automática

    node scripts/certify-lumia-realtime-vl05b.mjs
    node scripts/certify-lumia-realtime-vl05.mjs
    npx tsx scripts/certify-lumia-tts-stream-vl04.ts
    npm run certify:voice-gate
    npm run certify:brain
    npm run build
    npm run lint

## Protocolo Windows antes de habilitar en producción

1. Mantener las banderas de ensayo apagadas y probar el modo normal.
2. En la consola del proveedor, configurar presupuesto y revisar uso.
3. Guardar clave y PIN solamente en el entorno privado del bridge.
4. Habilitar temporalmente las dos banderas Realtime y hacer una prueba
   corta con auriculares para descartar eco, luego con altavoces.
5. Comprobar manualmente: cierre voluntario; 90 s; 20 s de handshake;
   error de dispositivo; cierre de pestaña; cambio a otra pestaña;
   caída de Wi-Fi; 5 PIN erróneos; límite de dos credenciales por arranque.
6. Confirmar el retorno a LUMIA local y que Voice Gate, STT, Kokoro,
   cancelación y herramientas continúan operando.
7. Medir latencia real con al menos 10 turnos (mediana y p95). Tomar nota
   de interrupciones, clipping, eco, turnos perdidos y la voz que realmente
   se escucha.
8. Deshabilitar flags de prueba y guardar la evaluación, sin audios,
   contraseñas ni datos biométricos en GitHub.

**La PR sirve para preparación y pruebas automáticas; NO acredita latencia
subsegundo, calidad acústica ni seguridad absoluta en el equipo Windows.**
