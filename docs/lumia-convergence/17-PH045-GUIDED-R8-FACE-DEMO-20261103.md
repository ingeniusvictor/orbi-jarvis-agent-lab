# PH-04.5 — Demonstración guiada de las 17 animaciones Motion R8 y expresiones VRM

## Hallazgo ASUS · 3 de noviembre de 2026

El usuario validó PH-04.4: rostro nativo, vistas intermedia y completa, selector primero a la izquierda y control por voz. Al pedir «Lumi, puedes hacer una demostración de tus animaciones», Whisper transcribió la orden, pero el controlador PH-04 no la reconoció y Qwen respondió que no tenía capacidad para generar animaciones. Otra frase («activa la versión de medio cuerpo») pasó al enrutador de modelos Ollama, aunque el usuario pedía una vista.

## Objetivo

Convertir el catálogo original de 17 FBX Motion R8 en un recorrido narrado **con la voz Kokoro y la animación del VRM sincronizadas al inicio real de cada frase audible**. Mostrar después las expresiones faciales estándar del VRM0: alegría (`joy`), tristeza (`sorrow`), enojo (`angry`), diversión (`fun`), y retorno neutral. Las expresiones se activan solo si están presentes en la malla del VRM privado.

## Ejecución

- Usuario: «Lumi, haz una demostración de tus animaciones» o «Lumi, muéstrame tus animaciones».
- LUMIA intercepta la intención **en el controlador local**, antes de pasar por Qwen o el selector de modelos Ollama.
- Se ejecuta una comprobación HEAD de **los 17 archivos FBX privados locales**: si faltan, se informa y no se simula una demostración.
- Se recuerda la vista anterior y se abre cuerpo completo para presentar el catálogo R8 **en el orden original**.
- Se genera un único guion narrativo, usando el **speaker existente**. Cada frase audible emite `onPhraseStart`, que activa exactamente su clip autorizado a través de `requestLumiaAvatarMotion`.
- Tras 17 movimientos, se abre la vista solo rostro. Se muestran las expresiones `joy`, `sorrow`, `angry` y `fun`, seguidas del rostro neutral. Mientras está hablando siguen activos parpadeo y visemas (forma de labios).
- Un panel reducido indica progreso y ofrece el control **Detener**. La interrupción de voz o botón cancela el recorrido; al terminar o detener se restablecen la vista previa y el movimiento automático R8.
- Si el clip FBX existe pero no puede retargetearse, el motor actual continúa con movimiento procedural y registra una advertencia: **no confundir existencia del archivo con reproducción visual certificada**.

## Límites

- No añade modelos de IA, motores TTS, micrófonos, permisos de control remoto ni binarios al repositorio.
- La narración está previamente diseñada y no improvisada por Qwen: evita prometer habilidades inexistentes.
- No constituye todavía un editor de poses o animaciones ni un retarget completo.
- La duración depende del tiempo real de generación/reproducción de Kokoro.
- El control de reproducción de los FBX depende de la compatibilidad del rig crudo VRM0; requiere QA físico de movimientos, boca, ojos y expresiones en ASUS.
- Los cuatro presets `joy`, `sorrow`, `angry`, `fun` se consultan en el VRM0 cargado antes de aplicarse. Si falta alguno, no se inventa.
- El modo explícito `lumiaR8=procedural` se respeta como respaldo: no se inicia el recorrido completo de FBX desde allí.
- La presentación predeterminada continúa siendo **solo rostro**. Ninguna selección de demostración cambia esa política.

## Comprobación ASUS

1. Abrir `http://localhost:5173/`; LUMIA debe iniciar solo rostro.
2. Pedir «Lumi, puedes hacer una demostración de tus animaciones».
3. Comprobar vista cuerpo completo, 17 frases/gestos de manera ordenada y panel de progreso.
4. Confirmar cambio a primer plano para las expresiones faciales, preservando sincronización de voz.
5. Al finalizar, retorno a solo rostro, postura natural, sin segunda voz ni recargas.
6. Iniciar nuevamente, pulsar **Detener** a mitad y confirmar que ya no se reproducen clips ni frases.
7. Pedir «Lumia, activa la versión de medio cuerpo»; debe cambiar el avatar, no el modelo Qwen.
8. Si falla algún clip, recoger consola y registro de conversación; no declarar paridad completa con Motion Lab.
