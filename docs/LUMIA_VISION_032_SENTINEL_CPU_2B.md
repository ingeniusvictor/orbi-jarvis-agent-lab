# LUMIA VISION-03.2A · Centinela óptico en CPU + Qwen3.5 2B nativo

## Propósito
VI-03.1 funciona como cámara de fotografías efímeras: el usuario activa una sesión de tres minutos, se actualiza un JPEG cada 12 segundos y Qwen interpreta una imagen solamente cuando se le pregunta. VI-03.2A añade un **Centinela de variaciones ópticas** que puede refrescar la foto local después de un cambio sin pedir cada vez «Volver a encuadrar».

**Cerebro nativo obligatorio:** `qwen3.5:2b-q4_K_M` en ASUS. El 4B sigue disponible por el selector manual «CEREBRO LOCAL», solamente para análisis visuales donde la imagen y el 2B no ofrezcan precisión suficiente. **Nunca** se activa por un evento de Centinela. Tampoco se cambia el modelo instalado, su cuantización o los parámetros de GPU.

## Implementado

- **Activación explícita doble:** arrancar con `INICIAR_LUMIA_ASUS_SENTINEL_CPU_2B_VI032.cmd`, abrir webcam a voluntad en el visor y pulsar **Activar visión**. Un flag por sí solo no abre la cámara.
- El Centinela usa **la misma webcam compartida**, sin segundo proceso `cv2.VideoCapture(0)` ni nuevo `getUserMedia()`.
- Toma un fotograma reducido **96×54** por CPU cada **750 ms** (~1,3 FPS). Se convierte localmente a luminancia, sin cargar pesos de detector, CUDA o WebGL.
- Región de interés **Centro** (cuadrilátero visible) o **Toda la imagen**, seleccionable en el visor y no persistente. Es una máscara de píxeles, no aún una zona de detección de personas.
- Compara la referencia óptica estable, requiere **dos muestras consecutivas** de diferencia suficiente, aplica **8 segundos** de enfriamiento y descarta variaciones globales de luz intensas.
- Si confirma un cambio, actualiza como máximo una foto reciente de la sesión para preguntas bajo demanda, con protección de 3 s entre codificaciones. **No llama a Ollama**, **no inicia voz**, **no graba video** ni envía eventos por red.
- Mantiene VI-03.1: captura periódica 12 s como respaldo, cierre a 3 min, corte por pestaña oculta, imágenes efímeras de máximo 20 s para consultas; el visor conserva «Analizar ahora».
- El diagnóstico visual en pantalla muestra **cambios ópticos**, no identidades, personas contabilizadas, entradas a una puerta ni certeza semántica.

## Arquitectura real, sin expectativas falsas

`Cámara compartida` → `Canvas 96×54 / CPU` → `Luminancia + máscara ROI + doble confirmación` → `cambio probable` → `JPEG reciente opcional` → `pregunta explícita del usuario` → `Qwen 2B` → `respuesta / Kokoro`.

Una variación de exposición, fondo en movimiento, monitor encendido, sacudida de cámara o sombra puede activar el Centinela. No sabe si una persona entró, salió o se sentó. Eso requiere un detector semántico real, con pruebas de rendimiento y precisión en CPU, no un prompt ni un simple umbral de pixeles.

## Política de 4B de visión

1. Por defecto **2B**, incluso en fotografía y lectura visual.
2. Si el 2B no puede leer un número de serie, una etiqueta pequeña, una alarma o una escena ambigua, **primero** solicitar reencuadre o fotografía nítida a 1024 px y reconocer límites.
3. Si el usuario aún requiere mayor análisis, puede seleccionar el **4B manualmente** en CEREBRO LOCAL, siempre que esté instalado y que haya memoria suficiente. No afirmamos que tenga mejor exactitud sin comparación física.
4. No hay cambio de modelo automático, doble inferencia ni «HABLAR/SILENCIO» decidido por el modelo ante presencia. El futuro mecanismo de escalado requerirá opt-in, presupuesto de recursos y pruebas de VRAM/latencia.

## Certificación y QA físico

```powershell
npx.cmd tsx scripts/certify-lumia-vision032-sentinel-cpu.ts
```

En la ASUS, verificar:
1. Sin abrir la webcam, el flag no activa ningún sensor.
2. Abrir visor y **Activar visión**. Deben mostrarse contadores, ROI y video. Cambiar Centro/Toda la imagen resetea la referencia.
3. Colocar un objeto dentro del polígono; moverlo y observar al menos un evento después de dos muestras. Repetir fuera del área Centro: no debe declarar un evento por ese movimiento aislado.
4. Probar cambio de luz y movimiento de la cámara: documentar falsos positivos; no atribuir personas.
5. Preguntar «Lumi, ¿qué ves ahora?»; debe utilizar foto reciente, no reabrir cámara ni activar 4B.
6. Preguntar algo no visual; no debe adjuntar imagen ni reducir la velocidad habitual de Qwen 2B.
7. **Detener visión** / ocultar pestaña / agotar 3 minutos: detener muestras, limpiar imagen activa y liberar cámara cuando no haya otros titulares del stream.
8. Probar sesiones repetidas, cámaras virtuales negras, cambio de resolución antes de activar y fuentes de error.
9. Registrar uso de CPU, RAM, VRAM (comparar `nvidia-smi`), retraso de primer texto y Kokoro contra VI-03.1, sin atribuir mejora hasta medirla.

## Camino posterior: VI-03.2B y VI-03.3

- VI-03.2B: integrar MediaPipe detector de personas/objetos en CPU **solo cuando exista un modelo compatible instalado y validado**, sin que la webcam tenga dos propietarios. Estabilizar detecciones por cuadros y zonas; no usar el detector de movimiento como si fuera detección de personas.
- VI-03.3: comparar dos **fotogramas autorizados** de distintos instantes para afirmar desplazamientos o entradas/salidas. No reutilizar solo el texto previo de Qwen como prueba del cambio.
- VI-03.4: avisos proactivos opt-in con reglas deterministas, silencio por defecto, máximo de notificaciones y prioridad explícita para el usuario y la conversación.
