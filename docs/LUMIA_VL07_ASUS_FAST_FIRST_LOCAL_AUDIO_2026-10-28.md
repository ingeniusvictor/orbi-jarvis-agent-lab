# LUMIA VL-07 — ASUS: primera frase Kokoro más corta y tiempos de preparación

## Evidencia inicial (captura 2026-10-28)
Primera respuesta del modelo en +1,44 s y primera reproducción en +10,88 s (separación 9,44 s). Pausa posterior entre frases: 0,01 s. La captura, por sí sola, no discrimina espera del primer fragmento, síntesis Kokoro y arranque de Chrome.

## Experimento solo en ASUS
`VITE_LUMIA_FAST_FIRST_CHUNK=1` solo cambia el primer fragmento cuando la voz solicitada y disponible es Kokoro local. Umbrales de mínimo/objetivo/máximo: 32/56/88 caracteres en lugar de 52/96/148. El resto de frases, el resto de proveedores y el modo predeterminado no cambian. Se cortan palabras solo en límites de espacios o cláusulas, sin añadir o quitar contenido. Conserva prefetch de la frase siguiente y residente Kokoro.

## Métricas (abrir panel D)
Se registra solo telemetría temporal y longitudes: caracteres de primera frase, tiempo desde la creación del speaker hasta encolarla, tiempo de solicitud/decodificación hasta WAV disponible, inicio de reproducción desde WAV listo y tiempo total hasta inicio de reproducción. Son observaciones de software; no indican tiempo acústico real ni calidad prosódica.

## Prueba A/B y reversión
Cerrar la instancia ASUS, hacer `git pull --ff-only` solo con árbol de trabajo limpio, iniciar `INICIAR_LUMIA_ASUS_RAPIDA.cmd`. Repetir una misma pregunta 10 veces con la bandera en 1 y otras 10 con bandera en 0; registrar primer texto, primera voz, tamaño de primera frase, TTS+WAV y navegador, junto con pausas y cortes de palabras. Si la frase corta suena artificial o empeora la velocidad, cambiar `set "VITE_LUMIA_FAST_FIRST_CHUNK=0"` y reiniciar. No cambiar otros parámetros durante la comparación.

## Seguridad y límites
Sin modificaciones de GLB, Whisper, Qwen, modelo Kokoro, permisos, rutas externas, datos sensibles, API paga ni `main`. CI prueba contratos y compilación, no velocidad física Windows. Las etapas VL-01..VL-06 se preservan.
