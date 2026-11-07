# LUMIA VISION-02.1 — Visor óptico transparente (QA ASUS)

## Hallazgo del usuario · 7 de noviembre de 2026

En la prueba física de VISION-02, el propietario autorizó la webcam, pero no pudo saber si LUMIA estaba observándolo a él, una pared o algún otro encuadre. Necesita **un recuadro en el espacio de la interfaz de LUMIA que refleje exactamente lo que capta la cámara** para interpretar y verificar las respuestas de Qwen3.5-2B.

## Resolución

Se incorpora `LumiaCameraViewfinder` como panel holográfico discreto a la derecha, separado del rostro y del dock de voz. Su área de video está a 16:9 y emplea `object-fit: contain` (sin recortar), **sin espejo**, porque la imagen que se entrega al modelo usa las mismas coordenadas de cámara; así el texto en etiquetas sigue siendo legible.

### Comportamiento al usar el botón Cámara

1. La pulsación abre **vista previa EN VIVO · SIN ANALIZAR**. Chrome/Edge solicita permisos como antes. Los fotogramas de preview permanecen en el navegador y **no se envían a Ollama**; no se graban ni se guardan.
2. El usuario puede ajustar la webcam o situar el objeto en el centro del recuadro.
3. Pulsar **Capturar y analizar** convierte precisamente el elemento `<video>` observado en el JPEG local acotado de VI-01; **antes** de iniciar la solicitud de inferencia se libera el lease de cámara. Esta es la única imagen que recibe LUMIA.
4. El panel cambia a **FOTOGRAMA CAPTURADO** y muestra de manera fija ese mismo JPEG, permitiendo comparar visualmente la respuesta hablada de Qwen con lo que recibió. Es una foto, no una supuesta imagen en vivo.
5. El propietario puede seleccionar **Volver a encuadrar**, **Cerrar imagen** o **Cerrar cámara**. Cerrar elimina inmediatamente el fotograma retenido en memoria de la interfaz.
6. Si se deja la vista previa abierta, se cierra automáticamente a los **90 segundos**, sin análisis automático.

### Comportamiento al pedir cámara por voz

- «Lumi, mira esto» y demás órdenes físicas explícitas del VISION-02 conservan la captura puntual rápida (sin obligar a abrir una vista previa adicional).
- Al conseguir el fotograma, el panel muestra una **foto fija exacta** correspondiente a los bytes enviados a Ollama. No debe presentarla como video continuo cuando ya se liberó la cámara.
- La cámara se libera antes de que Qwen analice y responda; si el permiso falla, no se muestra una fotografía inventada.

### Gestión de permisos y fallos

- Se reutiliza `camera.holdCamera()` / `releaseCamera()`, respetando otros módulos autorizados que pudieran mantener su propia cámara abierta.
- Desmontaje, cierre manual, error al reproducir video y vencimiento del preview liberan únicamente el recurso del visor. Incluso si el permiso del navegador llega después de haber cerrado el visor, la captura se descarta y se libera inmediatamente.
- El botón de fotografía VI-01 continúa funcionando; la captura de pantalla, cámara permanente y grabación de video siguen fuera de alcance.
- No hay llamadas a red nuevas, dependencias nuevas, rutas de Ollama distintas ni procesamiento visual agregado a conversaciones normales.
- Los 17 FBX Motion R8 y el VRM privado siguen intactos y pertenecen al otro chat de desarrollo.

## QA física ASUS antes de fusionar

1. Abrir VISION-02.1 por el icono Cámara y permitir acceso. Verificar que **EN VIVO** coincide con lo que realmente apunta la webcam: rostro, pared, objeto, etc.
2. Acercar una etiqueta o un objeto y verificar que se visualiza íntegro, no recortado ni invertido.
3. Pulsar **Capturar y analizar**. Verificar que la imagen se congela y que la luz de la webcam se apaga cuando no hay otros módulos usándola; la respuesta de LUMIA debe corresponder a **esa misma foto**.
4. Cerrar imagen y confirmar que el recuadro desaparece y se vacía. Volver a encuadrar debe pedir permiso solo si el navegador no lo conserva.
5. Probar la orden de voz «Lumi, mira esto» con la vista previa cerrada. Debe aparecer el fotograma congelado exacto del turno.
6. Negar permisos y comprobar que aparece mensaje de error, sin afirmaciones de visión ni recuento de fotogramas inexistentes.
7. Abrir preview, cerrarlo durante el prompt de permisos y, si luego se concede el permiso, comprobar liberación inmediata y ausencia de análisis.
8. Dejar la vista previa abierta sin interactuar: se cierra automáticamente a los 90 s.
9. Mantener conversaciones normales, cambiar las tres vistas VRM y probar las animaciones: no se debería iniciar automáticamente la cámara ni afectar la fluidez de Whisper/Kokoro.
10. Verificar diseño en resoluciones 16:9, portátil y móvil. El panel lateral no debe tapar botones de voz ni forzar scroll en toda la interfaz.

## Protección y rollback

PR borrador sobre rama VISION-02; `main` protegida. Para volver a comportamiento previo, activar `feature/lumia-vision02-owner-camera-20261107`, sin eliminar assets privados. Se conserva VISION-02 como módulo de captura puntual; este PR añade únicamente el visor, la opción de encuadrar y mostrar la imagen realmente analizada.
