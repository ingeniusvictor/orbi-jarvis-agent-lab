# LUMIA VISION-02.4.2 — Continuidad ASUS (7 noviembre 2026)

## Hallazgo de campo
En VISION-02.4.1, Qwen3.5 2B respondió a «¿cuántas personas están de pie y cuántas agachadas?» con un conteo y luego volvió a recitar la descripción inicial completa. La respuesta aumentó de 10,82 a 31,32 segundos. No se puede atribuir esa repetición exclusivamente al prompt; la ruta visual del adaptador Ollama incluía el historial textual anterior además de la fotografía y la pregunta.

## Corrección
- Solo en el branch `if(image)` de `streamOllama`, se excluye `...history` de los mensajes enviados al modelo: recibe sistema + JPEG autorizado + pregunta actual. El historial de chat normal sin imagen sigue intacto.
- La misma fotografía se reenvía para preguntas visuales a través del contexto efímero (cinco minutos); no hay segunda cámara, detector externo ni llamada adicional.
- El prompt exige respuesta enfocada, sin copiar la primera descripción, y evita confundir una imagen borrosa con la privacidad.
- Se conservan las instrucciones de consistencia visual 02.4.1, visor archivo/webcam 02.4, modelo, VRM, Whisper y Kokoro.

## QA real ASUS
Cargar la misma foto del grupo de ocho personas y repetir estas preguntas sin cargarla nuevamente:
1. «Lumi, describe exactamente lo que aparece en esta imagen y dime qué no puedes distinguir».
2. «Lumi, ¿cuántas personas están de pie y cuántas están agachadas?».
3. «¿De qué color es la camisa de la persona que está en el centro?».
4. «¿Qué puedes observar en el cielo y detrás del grupo?».

Evaluar especialmente si la respuesta de conteo se limita a la pregunta, si reconoce incertidumbre sin números inventados y si las preguntas normales siguen recuperando contexto. Comparar primer texto, primera voz y total con 02.4.1. No declarar mayor precisión numérica sin la prueba física.

## Desarrollo
Rama: `feature/lumia-vision0242-no-visual-echo-20261107`. PR #56 contra 02.4.1, borrador; `main` intacta. Certificación: `npx.cmd tsx scripts/certify-lumia-vision0242-no-echo.ts`, build, lint y regresión completa GitHub Actions.
