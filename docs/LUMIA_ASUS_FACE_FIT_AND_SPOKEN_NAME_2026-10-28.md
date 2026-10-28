# LUMIA ASUS — rostro dentro de los aros y pronunciación natural del nombre

## Objetivos y cambios
- El perfil ASUS utiliza `VITE_LUMIA_FACE_SCALE=0.92`: reducción uniforme del busto **8 %** alrededor de su centro geométrico, conservando `FACE_HEIGHT_FRACTION=0.47` y el desplazamiento horizontal de ASUS en 0 px. No se modifica GLB, texturas, materiales, malla ni la calibración canónica. El robot clásico ignora este override.
- La app conserva en texto, historia, contexto y rótulos el nombre **L.U.M.I.A.**. Solo la cadena preparada para TTS cambia la grafía punteada a **Lumia**, para que Kokoro la diga como nombre propio y no letra por letra.
- La conversión reconoce también `L. U. M. I. A.` y resiste fragmentos de texto generados progresivamente, evitando que un punto parcial origine frases aisladas. Otros acrónimos, por ejemplo O.R.B.I.A., no se reescriben.
- Se preservan Whisper local, Kokoro residente, Qwen 2B, VL-01..VL-07, permiso de escritura bloqueado, API de pago desactivada y `main` intacta.

## Reversión
Para recuperar el tamaño anterior ASUS, cambiar a `set "VITE_LUMIA_FACE_SCALE=1"` en `INICIAR_LUMIA_ASUS_RAPIDA.cmd` y reiniciar. Si la reducción resulta excesiva, una prueba intermedia sería 0.96. Solo se admiten valores finitos entre 0.80 y 1.00; fuera de ese rango se usa 1. La pronunciación se localiza en el módulo TTS y se puede revertir independientemente retirando la transformación de nombre.

## Certificación pendiente
- En ASUS revisar que cabello y hombros no salgan del aro en reposo, habla y animación leve. La prueba CI no demuestra ajuste visual real.
- Probar «Lumi, ¿cómo te llamas?» y «Lumi, preséntate». Debe escucharse «Lumia» como una sola palabra, mientras el texto puede conservar «L.U.M.I.A.».
- Probar lectura natural de «O.R.B.I.A.» y siglas técnicas; no deben perder información por este cambio.
- Registrar una captura de la vista y primera voz, con y sin VL-07 si se está evaluando latencia. No atribuir mejoras de voz a la escala visual.
