# LUMIA VL-05 — Conversación bidireccional WebRTC (piloto con permiso explícito)

Repositorio: ingeniusvictor/orbi-jarvis-agent-lab
Rama: feature/lumia-voice-webrtc-vl05
Base directa: feature/lumia-voice-streaming-vl04 (PR #16)
Estado: implementación de laboratorio, sin activar y sin certificar con audio real.

## Qué permite

- Nuevo control visible "LUMIA · VOZ REALTIME", accesible únicamente si el
  propietario habilita de forma consciente la bandera del frontend.
- WebRTC bidireccional: el navegador envía el micrófono y reproduce audio
  remoto con una conexión entre pares.
- Un servidor local solicita una credencial efímera a OpenAI usando la clave
  API *exclusivamente en el servidor*. El navegador recibe la credencial
  efímera, nunca la clave permanente del propietario.
- Al entrar, la app detiene el reconocedor normal Whisper/Chrome, la voz
  sintetizada y la respuesta anterior; al salir los reinicia, para que dos
  bucles de voz no compitan por el micrófono.
- En este piloto, el modelo Realtime no tiene acceso a herramientas, archivos,
  permisos, navegadores, automatizaciones ni operaciones sensibles. Su estado
  y conversación son independientes del agente normal LUMIA. No hay
  continuidad automática de memoria o historial entre ambos modos.

## Requisitos antes de habilitar el piloto

**No se activa por defecto. No se usa ninguna cuenta, clave o cargo sin que
el propietario configure y arranque manualmente el experimento.**

1. Contar con una clave OpenAI API propia y un proyecto con facturación y
   límites de gasto adecuados. La suscripción ChatGPT Plus no cubre API.
2. Configurar SOLO en el proceso privado del bridge:
   OPENAI_API_KEY=(secreto)
   ORBIA_REALTIME_EXPERIMENT=1
   ORBIA_REALTIME_OWNER_PIN=(secreto independiente de al menos 12 caracteres)
3. Configurar SOLO la bandera en la compilación frontend:
   VITE_LUMIA_REALTIME_EXPERIMENT=1
4. Usar el entorno de localhost. No publicar este bridge/credenciales en
   un servidor remoto ni permitir acceso a la sesión desde orígenes externos.
5. Arrancar frontend y bridge con las variables en sus respectivos procesos.
   El botón aparecerá únicamente tras el inicio normal de LUMIA; ingresar el
   PIN del bridge y pulsar "Iniciar prueba autorizada".

Las claves se conservan en el entorno local, no en GitHub ni en VITE_*.

## Límites y consentimiento

- Piloto limitado a un máximo de dos credenciales temporales por arranque
  del proceso bridge. Reiniciar el bridge reinicia el contador.
- Duración prevista de 90 segundos por conexión; se termina desde el
  navegador, sin inicio automático.
- PIN obligatorio, Origin HTTP loopback permitido y preferencia en ambos
  extremos. El resultado nunca concede herramientas.
- El límite de interfaz NO ES un control absoluto de facturación: una
  desconexión anómala, un cierre del navegador o el propio proveedor podrían
  mantener actividad hasta su cierre. El propietario debe configurar límites
  de presupuesto propios en la consola del proveedor ANTES de habilitar.
- Sin almacenamiento deliberado de grabaciones en este código.
  Se transmite audio a OpenAI al iniciar la llamada (y se aplican sus
  políticas de privacidad y datos API).
- La identidad acústica de un interlocutor NO está certificada: no se usan
  frases de voz para autorizar pagos, archivos, cuentas ni operaciones.
- Control de pausa/interrupción entregado al motor de Realtime, no hay
  promesa de equivalencia exacta con la voz local de LUMIA.

## Pruebas automatizadas

    node scripts/certify-lumia-realtime-vl05.mjs
    npm run certify:brain
    npm run certify:voice-gate
    npx tsx scripts/certify-lumia-tts-stream-vl04.ts
    npm run build
    npm run lint

La prueba nueva usa un simulador del proveedor; nunca emite solicitudes
externas reales ni cobra dinero. Valida fallo cerrado, autorización,
modelo/voz fija, 0 herramientas, límites por proceso y rutas de integración.

## Pruebas Windows pendientes

- Ensayar sin clave, sin bandera y con PIN erróneo: denegación y ningún cargo.
- Inicio, salida, interrupción, silencios y micrófono compartido; comprobar
  ausencia de audio duplicado, eco, captura tras terminar o bloqueo.
- Tiempo desde el fin del habla hasta el primer audio en 10+ interacciones.
- Capacidad de retornar al modo normal y mantener la seguridad Voice Gate.
- Límite de gasto en la consola y comprobación de uso real tras finalizar.
- Apagado ante desconexión, cambio de pestaña, red perdida y errores.
- Confirmar idioma y timbre de la voz; en piloto Realtime usa la voz marina
  (voice ID "marin"), que NO es todavía un perfil personalizado de LUMIA.

## Próximos pasos

VL-05B: auditoría de privacidad y controles del proveedor, audio físico
certificado, manejo robusto de interrupciones y seguimiento de consumo.
Solo entonces considerar producción en forma de modo seleccionable. Hasta
ese momento, mantener Whisper/Ollama/Kokoro como flujo principal local-first.

Autonomía A1, Voice Gate y branch main permanecen intactos.
