# PH-04.4 — Rostro nativo y selector visual a la izquierda

## Validación ASUS · 3 noviembre 2026

El usuario confirmó que PH-04.3 permite alternar las **tres vistas** y que el selector funciona. Pidió una modificación de presentación, no del motor: el control de avatar debe ser **la primera opción en el extremo izquierdo de la barra inferior**, inmediatamente antes del botón para adjuntar imágenes, dejando las opciones de voz a la derecha. También decidió que **solo rostro** sea la presencia habitual de LUMIA; medio cuerpo y cuerpo completo se reservarán para mostrar el alcance visual de Motion R8.

## Comportamiento nativo

| Dirección / orden | Presentación |
| --- | --- |
| `http://localhost:5173/` con PH-04 activado | **Solo rostro** (head-vrm) |
| `?lumiaAvatar=head-vrm` | Solo rostro |
| `?lumiaAvatar=bust-vrm` | Medio cuerpo, Motion R8 |
| `?lumiaAvatar=body-vrm` | Cuerpo completo, Motion R8 |
| `?lumiaAvatar=legacy` | GLB antiguo, respaldo |
| «Lumi, vuelve a la vista principal» | **Solo rostro** |
| «Lumi, cambia a medio cuerpo» | Medio cuerpo |
| «Lumi, cambia a cuerpo completo» | Cuerpo completo |

Las URLs con `lumiaAvatar` explícito conservan su elección. Sin el flag del lanzador `VITE_LUMIA_AVATAR_PH04=1`, el modo predeterminado heredado sigue siendo `legacy`; no se cambia el comportamiento de otros entornos.

## Interfaz

`LumiaViewDock` permanece dentro de `LumiaComposer`, pero se traslada antes del botón `lumia-composer-attach` y del cuadro de texto. No se dibuja otro selector flotante ni se duplican controles. Menú accesible con las tres vistas y estado seleccionado, tecla Escape y cierre al pulsar fuera.

## Conciencia de capacidades

En SKILL-01 el avatar aparece como capacidad experimental con rostro principal y dos presentaciones corporales animadas. La respuesta declarativa a «¿Qué vistas tienes?» y «Háblame de tu avatar» describe el rostro habitual y la existencia de Motion R8. El cambio de vista se ejecuta por un controlador local, no por afirmaciones no verificadas de Qwen.

## Reglas de interpretación

«Vista principal / normal / predeterminada / por defecto» activa rostro cuando no hay otra vista explícitamente nombrada. Una orden que menciona un destino específico, por ejemplo «cambia la vista principal a medio cuerpo», conserva el destino explícito. Si menciona dos destinos distintos se ofrecen las opciones sin ejecutar un cambio arbitrario.

Una solicitud de animación manual desde solo rostro todavía puede abrir medio cuerpo para que el gesto se vea. No altera la vista predeterminada de futuras aperturas.

## QA

- Certificación automática heredada PH-01/02/03/04/04.2/04.3 + nueva PH-04.4, npm build y lint.
- En ASUS, abrir sin parámetros, comprobar rostro dentro de los aros y el botón de vistas a la izquierda de adjuntar imagen.
- Verificar voz, botones y retorno a rostro desde cuerpo completo sin reiniciar Whisper/Kokoro ni deformaciones.
- Probar que medio cuerpo/cuerpo completo todavía reproducen Motion R8; no cambiar VRM ni FBX privados.
- PR borrador sobre PH-04.3, sin fusionar a `main`.
