# LUMIA WR-02 — Tolerancia acotada del procesamiento de comandos locales

Fecha: 2026-10-28; PR #28, rama experimental.

## Problema
La escucha de seguimiento pasa a WAKE tras 11 s, o a los 14 s después de despertar. Si el usuario **ya había empezado** una frase dentro del modo COMMAND, pero VAD/Whisper todavía no entregó el texto cuando vence el temporizador, `App.onUtterance` rechaza la petición al llegar en DORMANT. Esto es diferente a hablar después de que expiró la ventana o pronunciar un comando en FONDO.

## Cambio WR-02
El piloto ASUS habilita `VITE_LUMIA_ACTIVE_COMMAND_GRACE=1`. Solo cuando Whisper local confirma inicio de voz en un COMMAND ya autorizado, App amplía **una única vez** el timeout hasta 35 s **contados desde el inicio de la ventana**. Capturas posteriores no renuevan el plazo. El sistema conserva los modos WAKE y GUARD, antieco, filtros de música, palabra de activación y restricciones de escritura. El valor por defecto del producto es desactivado.

No autentica hablantes ni promete calidad o rapidez de reconocimiento. Un ruido que cruce el umbral del VAD durante COMMAND puede consumir la única extensión; si Whisper falla, la escucha se detiene igualmente al vencimiento. No afecta una pregunta que empieza después del cierre de 11 s: en ese caso se debe decir «Lumi» de nuevo.

## Reversión
En `INICIAR_LUMIA_ASUS_RAPIDA.cmd` cambiar a `set "VITE_LUMIA_ACTIVE_COMMAND_GRACE=0"` y reiniciar la instancia; otros perfiles permanecen sin cambios. No tocar GLB, Whipser, Kokoro, Ollama ni dependencias.

## Verificación pendiente en ASUS
1. Realizar al menos 10 seguimientos empezados dentro de los últimos 2 s de la ventana de 11 s y observar que la transcripción pueda concluir luego sin ser descartada.
2. Repetir 10 preguntas empezadas una vez vencida la ventana: no deben ejecutarse sin «Lumi».
3. Repetir audio de fondo, ruido de TV, eco de TTS, music annotations y «Lumi» aislado durante GUARD. Deben conservar sus protecciones.
4. Medir STT, tiempo hasta primera voz y anotar estado ESCUCHANDO/COMANDO, tras actualizar GitHub en Windows y habilitar `COPIAR REGISTRO` y D.

Las comprobaciones de GitHub CI son de contrato y compilación. No sustituyen la aceptación acústica sobre el equipo físico.
