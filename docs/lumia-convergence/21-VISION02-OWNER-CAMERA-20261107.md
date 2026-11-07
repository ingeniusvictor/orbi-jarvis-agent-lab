# LUMIA VISION-02 — Fotograma de cámara autorizado · Evolución del asistente

## Alcance

Este módulo es el primer paso de la nueva línea de inteligencia visual de LUMIA, **independiente del desarrollo VRM Motion R8**. Reutiliza el piloto VI-01 (foto seleccionada por el usuario) y la ruta multimodal nativa de Ollama, sin introducir servicios de pago, un segundo modelo obligatorio ni permisos generales de escritorio.

**Contrato de usuario:**
- Por voz, una solicitud física explícita como «Lumi, mira esto», «Lumi, ¿qué tengo en la mano?», «Lumi, lee esta etiqueta» o «Lumi, ¿qué ves en la cámara?» autoriza una captura de webcam y una respuesta hablada.
- Por interfaz, se añade el botón **Cámara** junto a Adjuntar fotografía. Una pulsación captura **una única imagen**. No comienza una sesión de video.
- Sin la orden por voz o pulsación de botón autorizada, **no se abre la cámara**.
- La captura mantiene el permiso de Chrome/Edge; si el navegador lo deniega, LUMIA explica el impedimento y no afirma que vio nada.
- Durante el acceso aparece el aviso `LOOKING — VISIÓN LOCAL · UNA FOTO SOLICITADA` en el HUD. La cámara se libera antes de entregar la foto comprimida al bridge para Ollama.
- Los datos de imagen no se guardan en archivos, conversación, historial, diagnóstico ni GitHub. La foto viaja en memoria como JPEG de tamaño limitado hacia el bridge local; la respuesta generada es texto y voz.
- El dispositivo de cámara es un recurso compartido y referenciado entre funciones. VISION-02 libera **su propio permiso temporal**; otro módulo previamente autorizado podría conservar su uso.

## Implementación

- `src/lib/vision-camera-vi02.ts`: intención de voz restrictiva, prompts basados solo en el fotograma actual, bloqueo de capturas simultáneas, descarte de turnos cancelados y devolución obligatoria del recurso.
- `src/lib/visual-input.ts`: reducción de imagen de webcam a JPEG acotado para cumplir los controles del bridge VI-01 (máximo 2.000.000 caracteres base64 y 1,5 MB decodificados).
- `src/lib/camera.ts`: refuerza liberación del MediaStream cuando `video.play()` falla después de obtener permiso y ya no hay propietarios.
- `src/App.tsx`: captura selectiva tras orden explícita; `ask(..., visualImage)` reutiliza el bridge local y Kokoro, sin modificar el camino ordinario de texto/audio. HUD durante el acceso, interrupción segura.
- `src/ui/LumiaComposer.tsx`: botón Cámara en la zona izquierda junto a Adjuntar imagen, con estado accesible `Capturando una imagen puntual`, deshabilitado durante dictado/traducción.
- `INICIAR_LUMIA_ASUS_RAPIDA.cmd`: `VITE_LUMIA_VISION_CAMERA_VI02=1` y `ORBIA_LUMIA_VISION_CAMERA_VI02=1` solo para el piloto ASUS; otros lanzadores conservan este módulo apagado.
- `bridge/orbia/skill-registry-skill01.mjs`: declara la captura puntual como experimental, sin insinuar video, pantalla ni capacidad visual garantizada.

## Restricciones y honestidad

1. El modelo local `qwen3.5:2b-q4_K_M` debe aceptar imágenes en la instalación ASUS; el contrato VI-01 está comprobado en código, pero todavía falta comprobar resultados de fotografías reales, tiempos, precisión y capacidad de memoria durante la inferencia.
2. **No** implementa visión continua, detección en tiempo real de objetos, acceso automático a pantalla ni seguimiento de personas.
3. La instrucción de «mirar» se reconoce solo si la frase se refiere al entorno físico presente. Preguntas sobre capacidades, páginas web, monitores, videos o procedimientos **no** activan la cámara.
4. El micrófono sigue bajo el flujo Whisper certificado; no se modifica el modelo Qwen, la ruta rápida de respuestas normales, Kokoro, ni Motion R8.
5. El permiso del navegador puede detener la captura; el programa no elude ni modifica la configuración del usuario.
6. Si se cancela el turno durante el permiso o preparación de la imagen, se descarta el fotograma, se libera la cámara cuando la API retorne y no se envía a Ollama.

## QA en ASUS

1. Iniciar con `INICIAR_LUMIA_ASUS_RAPIDA.cmd`; abrir `http://localhost:5173/`, pulsar Inicializar.
2. Confirmar que aparece **Cámara** a la derecha de Adjuntar fotografía, sin desplazar el micrófono.
3. Hacer clic en Cámara, aceptar permiso solo cuando el navegador lo solicite. Verificar aviso temporal LOOKING y luz física apagada tras obtener el fotograma (si ningún otro módulo tiene activa la cámara).
4. LUMIA debe responder en español describiendo elementos visibles, diferenciando incertidumbres. Si se le muestra texto pequeño, registrar si logra leerlo o admite que no se distingue.
5. Decir «Lumi, mira esto» sosteniendo un objeto y «Lumi, ¿qué tengo en la mano?». Verificar que no pide generar fotos o videos ni deriva a respuestas genéricas.
6. Denegar cámara y repetir: debe explicar que no pudo verla, sin inferir color, objeto o rostro.
7. Decir «Lumi, ¿cómo funciona la cámara?» y «Lumi, mira mi pantalla»: no debe encender la webcam.
8. Interrumpir una captura o cambiar de turno: verificar que no responde usando un fotograma ya cancelado.
9. Comprobar que una conversación ordinaria (sin imagen) mantiene las latencias obtenidas previamente y no activa cámara ni inferencia visual.
10. Si se produce error, recopilar **solo texto de consola**, modelo activo y tiempos de Ollama; no compartir archivos de fotos privadas ni base64.

## Próximas fases (NO implementadas)

- VISION-02B: pruebas reales con modelo local, calidad de descripciones, OCR y límites de tamaño.
- VISION-03: captura de pantalla aprobada explícitamente, independiente de la webcam.
- VISION-04: observación temporal por varios fotogramas, con indicadores, tiempo máximo y consentimiento renovable.

## Gestión de ramas

Nueva rama `feature/lumia-vision02-owner-camera-20261107`, basada en PH-04.8 certificada. Debe mantenerse en PR borrador y `main` protegida hasta QA de dispositivo ASUS. Los 17 FBX/VRM privados no se modifican ni se incorporan.
