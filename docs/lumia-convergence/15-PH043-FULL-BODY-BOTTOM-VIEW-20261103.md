# PH-04.3 — Vista cuerpo completo estable y selector en la barra inferior

## QA ASUS del 3 noviembre 2026
El usuario comprobó que PH-04.2 corrigió el modo `bust-vrm` y permitió cambiar por voz a `head-vrm`; sin embargo, observó nuevamente una deformación corporal al cambiar a `body-vrm`. La captura de cuerpo completo muestra el avatar entero dentro del anillo y la parte inferior muy cerca de la barra de diálogo. También solicitó un botón discreto para elegir las tres vistas directamente desde la barra inferior, sin necesidad de hablar.

## Modificación de interfaz
- Mover el selector del extremo superior derecho al **mismo compositor inferior existente**.
- Una única pulsación sobre un icono de avatar abre un menú accesible encima del compositor con `Solo rostro`, `Medio cuerpo` y `Cuerpo completo`.
- Respetar teclado, Escape y pulsación fuera del menú; mostrar selección activa y mantener la función de voz.
- No crear segunda barra flotante, nuevo chat, micrófono ni recargar la página.
- Preservar `bust-vrm` como opción predeterminada (y las URLs directas por si hicieran falta).

## Modificación del motor Motion R8 para cuerpo completo
- Conservamos el perfil R8 conocido como funcional de medio cuerpo, sin cambiar sus límites.
- Añadimos un envelope *específico de cuerpo completo* para hombros, brazos, torso, caderas, piernas, pies y dedos; el movimiento manual mantiene mayor rango que el automático.
- El cuerpo completo vuelve a la posición original de sus piernas en cada frame **antes de aplicar cualquier FBX**. Esto evita heredar una rotación residual tras una animación.
- No se altera el VRM/FBX original, el sistema de labios, ojos/cabeza ni el mecanismo STT/Kokoro/LLM.
- QA reversible: `?lumiaAvatar=body-vrm` es seguro por defecto, `&lumiaR8=expressive` muestra la animación sin envelope, `&lumiaR8=procedural` deshabilita FBX.

## Límites de esta fase
El motor sigue utilizando el rig VRM0 crudo con retarget FBX experimental, que no es idéntico a la arquitectura normalizada de Motion R8. Los límites de amplitud y restablecimiento de piernas reducen el riesgo de una pose deformada, pero **no certifican la naturalidad definitiva** ni corrigen los errores de pesos o mapeo que únicamente se observarían en el modelo privado sobre ASUS.

## Criterios de aceptación
- CI completa PH-01, PH-02, PH-03, PH-04, PH-04.2 y PH-04.3 + build/lint.
- En ASUS, abrir directamente la vista de medio cuerpo y cambiar con el nuevo icono inferior a rostro y cuerpo completo, luego regresar al medio cuerpo; verificar que no hay otra botonera duplicada en la esquina.
- En la vista cuerpo completo, probar 30–60 segundos en reposo y después conversación, escucha y gesto; revisar brazos, rodillas y tobillos.
- Verificar ojos, labios, voz, control por comandos y barras de diagnóstico sin cambios.
- Si un FBX sigue deformando, comparar con `&lumiaR8=procedural` antes de plantear una modificación del retarget; el PR permanece borrador y `main` protegida.
