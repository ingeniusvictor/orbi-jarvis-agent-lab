# VISION-02.2 — Selección de webcam y advertencia de señal de privacidad

## Evidencia real ASUS · sábado 7 noviembre 2026 16:57

Captura del usuario: LUMIA Vision mostraba un **fotograma negro con un símbolo blanco de un dispositivo móvil y un candado**, etiquetado como `FOTOGRAMA CAPTURADO`. Qwen3.5-2B describió precisamente un teléfono móvil con candado blanco sobre fondo negro. El usuario esperaba verse a sí mismo frente a la cámara.

**Conclusión respaldada por el diagnóstico:** el análisis visual recibió y describió la imagen entregada por la cámara; no hay evidencia de que recibiera la escena física que el usuario esperaba. El permiso de Chrome no garantiza una señal válida. La documentación oficial de Microsoft sobre usar un teléfono Android como webcam vinculado a Windows 11 indica que un **placeholder negro con icono blanco** puede aparecer cuando falta autorización del teléfono; su solución es revisar el aviso de la cámara en la barra de tareas, autorizar `Link to Windows` en Android o seleccionar otra fuente de cámara.

Fuente: https://support.microsoft.com/en-us/windows/apps/phonelink/use-your-mobile-device-s-camera

No afirmar que se verificó de forma remota qué webcam concreta estaba seleccionada. Otras causas posibles incluyen aplicaciones de cámara virtual, privacidad del fabricante o lente tapada.

## Implementación PH VISION-02.2

- Se añade al visor un selector **CÁMARA**, con opción predeterminada de Windows y lista de fuentes `videoinput` autorizadas por el navegador, con nombres reales del dispositivo. Se muestra también `Origen usado: <nombre>` durante la vista previa y después de la captura.
- La preferencia se almacena solamente **en memoria del módulo**, no en `localStorage`, fichero, logs ni bridge. Se aplica tanto al botón Cámara como al próximo comando por voz `Lumi, mira esto`. Para fuentes elegidas, `getUserMedia` usa `deviceId:{exact:id}`; la opción predeterminada mantiene `facingMode:user`.
- Cambiar de fuente cierra el lease de la vista previa antes de abrir otra. No cambia una cámara mientras otro módulo tiene un lease activo, para proteger manos/legacy, y muestra mensaje de conflicto en el visor.
- Después de que el usuario haya abierto la cámara, se inspecciona **una sola muestra local de 48×27 píxeles**, sin subir fotogramas ni grabar video. Si casi todo es negro (incluida la imagen negra con icono blanco) aparece una advertencia de posible privacidad, cámara virtual o falta de luz. Es solo un aviso: **no bloquea capturas oscuras válidas** ni infiere identidad.
- Cuando el origen contiene palabras de cámara virtual/móvil/Phone Link, se añade un consejo para elegir una webcam integrada si no se ve la escena.
- El JPEG entregado a Qwen sigue siendo exactamente el fotograma mostrado. Sin cambios al modelo, Whisper/Kokoro, visor VRM, imágenes privadas, puertos o pipeline de conversación normal.

## Pasos inmediatos para el usuario

1. Abre `chrome://settings/content/camera` y selecciona `Integrated Camera` o webcam física en lugar de una cámara móvil/vinculada.
2. Si se utiliza una cámara de Android por Enlace Móvil, verifica el aviso emergente de cámara en la barra de tareas, autoriza la cámara en el teléfono para `Link to Windows`, o desactiva provisionalmente `Usar como cámara conectada` en Configuración → Bluetooth y dispositivos → Dispositivos móviles.
3. En LUMIA VISION-02.2, abre Cámara, comprueba el campo `Origen usado`, elige otra cámara en el desplegable, verifica el video en vivo y captura una imagen reconocible solo después.
4. Si también falla la app Cámara de Windows, comprueba la cubierta física de la webcam, los permisos de Windows y el software de privacidad del fabricante antes de modificar Ollama.
5. Compara la imagen congelada con la respuesta; no usar capturas privadas en GitHub.

## QA ASUS

- Preview real integrado, selector muestra nombres de dispositivos autorizados.
- Si hay dispositivo móvil/virtual, elegir webcam física y confirmar que video cambia sin recargar.
- Cerrar la vista y solicitar `Lumi, mira esto`: debe mantenerse la cámara elegida en esta sesión del navegador.
- Cambiar dispositivo mientras otro módulo lo usa debe mostrar error sin apagar su stream.
- Webcam que transmite placeholder negro produce advertencia; escena iluminada no.
- No se accede a la cámara al abrir la página ni durante conversación normal.
- `Capturar y analizar` sigue cerrando el lease antes de inferencia; visor foto fija exacta.
- CI sintética certifica preferencia, `getUserMedia` exacto, nombres de dispositivos, control de lease, señales oscuras y regresiones VI-01, VI-02, VI-02.1, PH-04.8, build/lint.

PR hijo en borrador sobre VISION-02.1, `main` intacta. Las pistas/modelos VRM privados quedan fuera de esta línea.
