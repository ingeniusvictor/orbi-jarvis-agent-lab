# PH-04.7 — Animaciones individuales por voz y menú · QA de aplauso y negación

## Evidencia física ASUS — 3 de noviembre de 2026, 17:27–17:39

El usuario corroboró que la demostración completa PH-04.6 ya respeta mucho mejor los tiempos. Se mantienen dos defectos visuales: **No.fbx** parece incompleto y **Clapping.fbx** conserva las manos demasiado separadas, mientras que en la referencia del Motion R8 natural original casi se tocaban. La petición individual «Lumi, quiero ver tu animación de aplaudir» y dos variantes imperfectas de Whisper terminaron equivocadamente en Qwen, que propuso generar HTML/CSS o videos en lugar de controlar el VRM existente.

El usuario solicitó además un **botón de Animaciones como segunda opción de la barra inferior**, entre Vista del avatar y Adjuntar imagen, para tener control por voz y manual.

## Causas técnicas revisadas

1. El parser anterior reconocía `aplaude`, `ejecuta animación clapping` o `reproduce…`, pero no órdenes naturales «quiero ver tu animación» ni STT «Muestramiento animación de aplaudir».
2. El importador FBX excluía globalmente `head`/`neck`. Incluso cuando se autorizan para No.fbx, la tabla Mixamo omitía los nombres comunes `Head` y `Neck`.
3. El perfil seguro de cuerpo completo limitaba bastante los hombros y los codos; Clapping.fbx no tenía suficiente rango para reproducir la trayectoria original del aplauso.
4. Los desplazamientos semánticos corporales podían superponerse a los brazos del FBX durante una frase. Se separan los controles para que cada gesto explícito tenga prioridad.
5. Un gesto individual continuaba sujeto a un corte fijo de 7,5 segundos. Se aplica la reproducción completa del clip, incluyendo las repeticiones del catálogo, tanto a solicitudes por voz como manuales.

## Implementado

- **Menú**: botón de animaciones inmediatamente después del botón de avatar y antes de Adjuntar imagen; tres categorías (`conversacion`, `emociones`, `movimiento`) obtenidas del catálogo único de 17 clips. Incluye `Demostración guiada completa`, `Volver a gestos automáticos` y un menú accesible con desplazamiento vertical y tecla Escape.
- **Voz**: se autorizan variantes exactas del diagnóstico: «Muestramiento animación de aplaudir», «No lo mismo, lo que quiero es que me muestres la animación que tienes tú de aplaudir» y «Lumi, quiero ver tu animación de aplaudir». No se envían a Qwen cuando corresponden a un gesto del catálogo. Consultas de Blender, CSS o video no disparan un FBX.
- **No.fbx**: el importador permite pistas `head` y `neck` únicamente para este clip. El seguimiento del cursor deja de sobrescribirlas mientras se reproduce ese FBX con pistas compatibles, y vuelve automáticamente al terminar. Si el original carece de pistas de cabeza/cuello, el navegador registra esa condición; no se inventa una animación nueva.
- **Clapping.fbx**: solo cuando se solicita expresamente se amplía la envolvente angular de hombros, brazos, antebrazos y manos. Los demás 16 clips conservan su perfil seguro. No se fuerza artificialmente el contacto de manos; se registra la distancia mínima entre los centros de muñecas después de las protecciones, para ayudar a revisar el retarget.
- **Reproducción**: comandos puntuales respetan ahora la finalización del `AnimationMixer` y los ciclos de clips repetidos o en loop, como la demostración completa. `Talking.fbx` puntual no se corta por acabar la locución.
- **Presentación**: desde solo rostro, un gesto de brazos abre medio cuerpo; un movimiento de piernas abre cuerpo completo. Una vista ya seleccionada se conserva.
- **Protección**: no se tocan el VRM, los 17 FBX privados, el sistema de voz, las expresiones faciales ni `main`.

## Límite explícito

La corrección elimina bloqueos y mezcla de movimientos que distorsionaban Clapping y No, pero **no certifica contacto real de palmas ni equivalencia visual definitiva con Motion R8 original**. El portal todavía usa VRM0 raw bones y retarget experimental; los archivos FBX están solo en ASUS. Si hay diferencias residuales, comparar las pistas/huesos reales y el resultado de la consola de QA antes de modificar la geometría o reemplazar el rig.

## Validación ASUS

- Abrir `http://localhost:5173/` y comprobar que los tres primeros elementos de la barra sean **Vista · Animaciones · Adjuntar imagen**.
- Desde rostro, usar menú `Aplaudir`; confirmar medio cuerpo, tres repeticiones completas, sin otros movimientos de brazos superpuestos.
- Repetir desde cuerpo completo y observar si las manos se acercan; recoger consola `[lumia:ph047] QA clapping minimum wrist-center distance`.
- Abrir `Negar / No` desde el menú: verificar cabeza/cuello y la trayectoria del gesto completo; revisar `head/neck authored` en consola.
- Decir «Lumi, quiero ver tu animación de aplaudir»; debe ejecutar el mismo ID de `Clapping.fbx` y no describir HTML/CSS.
- Probar `Demostración guiada completa` y el retorno a `gestos automáticos`; no debe reiniciar Ollama, Whisper o Kokoro.
- Confirmar que los ojos, visemas, rostro predeterminado y los otros 15 gestos permanecen intactos.
