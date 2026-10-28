# LUMIA RA-01 — Diagnóstico de pausas entre frases y prueba del cerebro local

## Incidente observado

En la captura del propietario:
- Comando aceptado a las 23:33:07.277.
- Primer texto de Ollama tras 4,97 segundos.
- Primera salida de voz tras 6,34 segundos.
- Pausa previa a la segunda frase: 14,56 segundos.
- Fin de respuesta: 39,67 segundos.

No es correcto atribuir los 14,56 segundos exclusivamente a Kokoro:
la ruta RC-01 de streaming libera el primer fragmento `¡Claro!`
antes de que Ollama termine de generar la explicación. Kokoro
residente también utiliza CPU. Es necesario diferenciar cuándo
**llegó** la frase siguiente y cuándo quedó **lista** para reproducirse.

## Instrumentación RA-01

Cada frase del registro TL-01 incorpora:
- hora en que la frase completa fue encolada por el frontend, tras
  recibir el texto desde Ollama;
- hora de finalización de síntesis local para esa frase (si
  hubo síntesis mediante TTS y este devolvió un recurso de audio);
- hora de inicio real detectado con el evento de reproducción;
- duración total de la pausa desde fin de frase anterior;
- la parte de esa pausa esperando palabras de Ollama;
- la parte esperando a que estuviera listo el audio WAV de Kokoro;
- la parte restante esperando reproducción en navegador.

Los tres últimos componentes son disjuntos y suman la pausa total
cuando hay datos de audio generados. Son tiempos observados en
el navegador y **no se deben confundir con acústica medida con un
micrófono**. Si cae a `speechSynthesis` de Windows, la división del
componente de TTS puede quedar sin valor.

Los indicadores están en pantalla, en diagnósticos D y en el botón
`COPIAR REGISTRO`. No se modifica selección de modelos, formato
de respuestas, VAD, cierre del micrófono ni geometría de LUMIA.

## Prueba de modelos locales recomendada

El propietario confirmó mediante `ollama ps` que
`orbia-lumia:4b` se ejecuta al **100 % CPU** (esto se refiere a
la ubicación de las capas, no a la ocupación total de CPU), con
contexto 4096 y aproximadamente 3,2 GB residentes.
`ollama list` indica que tiene instalado también `qwen3:1.7b`.
El equipo reporta `AMD Radeon(TM) Graphics`, sin NVIDIA.

Comparar ambas respuestas a una misma pregunta mediante la API
local con `think:false`, mismo formato de respuesta y
`num_predict` limitado. Registrar:
- `total_duration`
- `prompt_eval_duration`
- `eval_duration`
- `eval_count`
- tokens/segundo
- calidad de español y precisión en preguntas de IA local.

Una prueba aislada de velocidad no reproduce la competencia simultánea
Ollama + Kokoro y Whisper en LUMIA. No se debe cambiar el modelo
canónico ni solicitar ninguna descarga sin la aprobación del
propietario. El modelo menor puede ser más rápido, pero también
menos preciso. Nada garantiza velocidad de Grok Bot sin
aceleración y mediciones en el hardware real.

## Restricciones de publicación

- PR experimental apilado sobre RC-01 (#23), VA-01 (#22) y TL-01 (#21).
- No modificar `main`, accesos directos, configuraciones del sistema,
  modelos residentes en Ollama ni el GLB local.
- El encuadre aprobado `LumiaAvatar.tsx` se modificó localmente en
  Windows: conservarlo al actualizar el worktree.
- No alterar la configuración de Whisper server ni activar WebRTC
  o proveedores de voz de pago.
