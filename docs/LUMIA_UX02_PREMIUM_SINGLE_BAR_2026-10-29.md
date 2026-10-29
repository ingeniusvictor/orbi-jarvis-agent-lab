# LUMIA UX-02 — Interfaz de conversación aprobada: una barra minimalista

Referencia visual aceptada por el propietario: una única barra horizontal, baja, translúcida, colocada al pie de la interfaz y no sobre el rostro. Controles discretos tipo mensajería, iconos y tooltips accesibles. No inventar menús, navegación o herramientas inexistentes.

Alcance:
- Un solo renglón de controles con imagen local VI-01, textarea de crecimiento limitado, botón de dictado Whisper, botón independiente de micrófono abierto y botón de envío.
- El campo permanece disponible con cualquiera de los modos; dictado de una pregunta retorna a entrada de texto al completar la transcripción. El micrófono abierto solo se activa tras pulsar su botón y es reversible.
- Los adjuntos y errores aparecen como chips pequeños cuando existen, sin panel fijo de instrucciones.
- La grabación exhibe indicador visible y botón accesible de cancelación. Los botones llevan aria-label, title y aria-pressed cuando corresponde.
- No tocar avatar GLB, cámara, holograma, anillos, temas externos, modelos Ollama, Kokoro, permisos de escritura o API de pago.
- CSS glassmorphism sobrio: blur 16 px, transparencia, borde fino cian, acento en estado activo y botón de envío. Responsive y reduce motion.

Validación exigida: CI contrato UX-01 y UX-02, build, lint. La revisión visual y del hardware de Windows solo puede certificarse con la captura del usuario después de actualizar.