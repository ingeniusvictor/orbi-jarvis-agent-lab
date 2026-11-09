# LUMIA VI-03.2B — Ver realmente lo que muestra la webcam al preguntar

## Evidencia que motivó este parche

El 8 de noviembre de 2026, una captura inicial produjo una descripción con camiseta NASA, pero varias preguntas posteriores omitieron a otro menor visible según el usuario o mencionaron un uniforme azul y chaleco que no podemos verificar. Las transcripciones Whisper incluyeron: «Qué es ahora», «Lumia, que estás viendo», «Ahora que veas Lumia», «Y ahora que está viendo, Lumi», «está es mi hijo el frente de la imagen, ¿por qué no logras verlo?» y «revisar nuevamente, porque la cámara está viendo a mí y a mi hijo».

**No está probado** que todos esos turnos llevaran un JPEG al modelo. El turno inicial fue 23:15 y el siguiente 23:19:49: el intervalo excede el máximo de 180 segundos de una sesión activa. Sin datos de sesión/captura por turno, no atribuir errores solamente a Qwen.

## Corrección VI-03.2B

- Con bandera `VITE_LUMIA_VISION_FRESH_VOICE_VI032B=1`, las consultas explícitas del entorno y las frases Whisper observadas se reconocen como preguntas visuales, sin modificar Whisper globalmente.
- Durante la sesión autorizada, cada pregunta visual toma **un fotograma nuevo desde el mismo video del visor**, conservando el stream existente. No abre otro dispositivo ni espera a la próxima fotografía de 12 s.
- Se adjunta el JPEG al turno de Qwen3.5 2B, junto con instrucciones para mirar todo el encuadre: personas visibles (incluidas parcialmente), posición, ropa comprobable, incertidumbre. No se identifica a personas ni se acepta «es mi hijo» como evidencia visual.
- Sin sesión activa, o si falla la captura actual, LUMIA **no manda una fotografía anterior como si fuera actual ni pide al modelo adivinar**: informa de la cámara desactivada o del problema óptico y explica cómo reactivar.
- Preguntas sobre una foto antigua explícitamente mencionada siguen el flujo de contexto visual anterior.
- Telemetría local sin imagen/texto en Console: `[lumia:vision-vi032b]` con `route`, `attachedJPEG`, `frameAgeMs`, `resolution` y `visionActive`.
- La frase ambigua «qué es ahora» solo se considera solicitud de visión en una sesión activa.
- Qwen3.5 2B sigue nativo. 4B, si existe, solo selección manual excepcional para visión detallada; no se activa automáticamente. No cambian Kokoro, GPU, cuantización, 750 ms del Centinela ni su ausencia de inferencia espontánea.

## QA físico ASUS

1. Cerrar LUMIA, activar rama nueva y ejecutar `npx.cmd tsx scripts/certify-lumia-vision032b-fresh-voice.ts`.
2. Lanzador nuevo; entrar al visor y pulsar **Activar visión**. Alinear webcam para incluir a dos personas con rostro/torso visibles.
3. Decir «Lumia, ¿qué estás viendo?» y «Y ahora, ¿qué está viendo, Lumi?» mientras una de las personas cambia de posición. Deben aparecer trazas `route:"live-fresh"`, `attachedJPEG:true` y una antigüedad mínima; el visor no debe cerrarse.
4. Decir «esta es mi hijo... ¿por qué no lo ves?» o «revisa nuevamente»: debe enviar una **captura nueva** y describir sin asumir parentesco, contar dos personas solo si ambas son visibles.
5. Preguntar algo no visual («¿qué hace un inversor?»): sin nueva captura ni trazas `live-fresh`.
6. Dejar expirar la sesión tres minutos (sin reactivar). Preguntar «¿qué estás viendo ahora?». Debe reconocer que no está viendo ahora, sin inventar uniforme/rostro y sin reabrir cámara silenciosamente. La frase ambigua «¿qué es ahora?» fuera de sesión no debe abrir cámara.
7. Probar permiso denegado, cámara virtual negra, pérdida de stream, cierre de visor durante pregunta. Verificar mensaje de fallo en lugar de respuesta visual sin imagen.
8. Medir primer texto, primer audio y carga CPU/VRAM en preguntas visuales y de texto. Confirmar Qwen 2B nativo.

## Limitación

La corrección garantiza **origen y actualidad de la fotografía para los turnos que reconoce**; **no garantiza que el 2B detecte todas las personas**. El siguiente incremento debe introducir conteo independiente en CPU con un detector semántico validado, y contrastar Qwen 2B solo ante fallos comprobados. Verificar que realmente haya dos figuras completas en el encuadre antes de evaluar falsas omisiones.
