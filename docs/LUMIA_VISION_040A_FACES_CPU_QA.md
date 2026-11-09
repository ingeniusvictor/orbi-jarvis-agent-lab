# LUMIA VISION-04A — Detección facial real, sin identificar personas

## Objetivo

Cambiar el criterio de «Qwen dice que hay dos personas» por una señal independiente: un detector especializado identifica **rostros visibles** en la webcam y dibuja recuadros sobre cada uno. Es el primer hito hacia el registro voluntario de identidades. Un rostro detectado NO equivale a una persona reconocida ni prueba un parentesco.

## Arquitectura implementada

`webcam compartida` → `visor VI-03.1/03.2` → `ImageBitmap (máx. 640×360, 900 ms)` → `Web Worker MediaPipe BlazeFace/CPU` → `rectángulos normalizados + conteo estable` → `recuadros y número en visor`.

- **Misma cámara**, sin otro `getUserMedia`, OpenCV, Python ni proceso de servidor adicional.
- **CPU explícita**, con `delegate:'CPU'`. El modelo BlazeFace NO ocupa por diseño un bloque adicional de pesos en la VRAM de la GTX 1650 Ti. El navegador puede seguir utilizando GPU para representación general, así que el uso total de VRAM debe medirse.
- **Web Worker dedicado**: la inferencia síncrona de MediaPipe se hace fuera del hilo principal de React. Solo una muestra a la vez, máximo 640×360, una cada 900 ms y timeout de 6 s. El tiempo real de inferencia se muestra en el panel.
- **Consentimiento en tres etapas**: lanzador VI-04A, apertura voluntaria del visor y botón **Activar visión**; después botón específico **Detectar rostros · CPU**. El detector no funciona fuera de la sesión visual.
- **Preservación:** la sesión mantiene el máximo de 3 minutos, cierre de cámara al ocultar pestaña o cerrar visor y rollback a VI-03.2B. No se habilita otra captura por detrás.
- **No hace reconocimiento**: no compara características biométricas, no registra nombres, no intenta identificar al usuario, no asigna edades exactas, no genera notificaciones ni habla automáticamente. No se guarda ninguna fotografía ni representación facial. En el worker se descarta cada ImageBitmap después de procesarlo.
- **Qwen3.5 2B nativo** para conversación y visión general. El 4B no se carga automáticamente; sigue siendo opción manual y excepcional. Sin cambios en Whisper, Kokoro, Ollama o los modelos locales.

## Instalación del detector

El lanzador `INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd` llama al instalador local `scripts/install-lumia-face-model-vi04.mjs` **antes** de iniciar el lanzador VI-03.2B. Si no existe la copia local, descarga una sola vez los pesos oficiales BlazeFace Short Range de Google, con tope de 4 MB y validación TFLite; quedan en `public/models/vision/blaze_face_short_range.tflite`, ignorados por Git. **No descarga ni comparte fotografías personales.**

Para sesiones posteriores no hace falta conectarse a internet para cargar esos pesos. El runtime MediaPipe WebAssembly procede de `node_modules/@mediapipe/tasks-vision/wasm` copiado por el arrancador existente a `public/mediapipe`. Si la descarga inicial falla, LUMIA debería poder continuar normalmente; el botón facial mostrará error hasta instalar el archivo local. **Las pruebas automatizadas no certifican la disponibilidad real del modelo ni de la webcam física.**

## Primera aceptación física ASUS

1. Cerrar LUMIA y descargar la rama nueva; confirmar `Qwen3.5 2B`.
2. Ejecutar el script de certificación; arrancar con `INICIAR_LUMIA_ASUS_ROSTROS_VI040A.cmd`. Verificar que el instalador encuentra o descarga los pesos del modelo.
3. Abrir LUMIA VISION, activar la visión, pulsar **Detectar rostros · CPU**. Comprobar el estado de carga y los recuadros.
4. **Una persona adulta** de frente, iluminación suficiente: esperar a que confirme un rostro tras dos muestras. Observar latencia de CPU, no prometer 30 FPS.
5. **Dos personas adultas** claramente encuadradas: esperar a que confirme dos rostros y sus cajas independientes. Si el usuario realiza pruebas adicionales con un menor, se requiere permiso de su responsable y no se almacena su imagen/identidad.
6. Una persona sale: comprobar que el conteo se actualiza, que no «recuerda» su rostro; oclusión, perfil y persona de espaldas pueden dar 0 rostros aunque haya personas.
7. Preguntar por voz «Lumi, ¿qué estás viendo ahora?»: debe seguir Qwen 2B y usar el JPEG nuevo del VI-03.2B, sin que el detector facial altere el cerebro.
8. Desactivar el detector: desaparecen recuadros y análisis; cerrar la cámara, ocultar pestaña o agotar 3 minutos: cesa el worker y se liberan recursos. Probar reactivaciones repetidas.
9. Medir CPU, RAM, VRAM, primera respuesta de Qwen y pausas de Kokoro con detector apagado/encendido. Sin métricas físicas no se afirmará coste cero o funcionamiento certificado en ASUS.
10. Observar con luces cambiantes, fondo brillante y webcam virtual; no declarar identidades a partir de falsas detecciones.

## Próximas fases (NO implementadas)

- **VI-04B**: pruebas de detección facial frontal/perfil y verificación del conteo. Solo si supera QA físico conectar información de presencia a preguntas a Qwen.
- **VI-04C**: registro voluntario de rostros para adultos, modelo de características faciales con licencia comercial apta, coincidencia calibrada, consentimiento y borrado explícito; almacenar protegido localmente. Los menores requieren controles reforzados y autorización específica.
- **VI-04D**: memoria conversacional de personas *reconocidas*, no suposiciones de parentesco o identidad; umbrales contra falsos positivos, opción «no reconocido», verificación ante fotos de presentación y avisos sociales opt-in.
