# VOICE-01I — reproducción física ASUS certificada (2026-11-11)

> **PASS de reproducción local de fragmentos; evaluación perceptual de identidades A/B/C PENDIENTE.** El usuario ejecutó la versión corregida de `voice01_listen.py` sobre los dos WAV públicos del holdout, después de resolver el `AttributeError` de `winsound.SND_SYNC`. La salida íntegra del proceso indica que completó la reproducción y terminó sin errores. **El registro no es evidencia de cómo suenan las voces o si son la misma persona**; esa valoración solo puede facilitarla un oyente o una anotación independiente.

## Evidencia del equipo

**Audio 2:** `2-two-speakers-en.wav`

| Clip | Intervalo reproducido | Etiqueta CAM++ previa a umbral 0.50 |
| --- | --- | --- |
| 1 | 0.200–2.500 s | speaker_0 (A de referencia local) |
| 2 | 3.000–6.500 s | speaker_1 (B de referencia local) |
| 3 | 21.500–26.500 s | speaker_2 (C, grupo adicional por comprobar) |

Salida final: `{"lab":"VOICE-01I","ok":true,"clips_played":3,"files_written":0,"microphone_enabled":false,"identity_confirmed":false}`.

**Audio 3:** `3-two-speakers-en.wav`

| Clip | Intervalo reproducido | Etiqueta CAM++ previa a umbral 0.50 |
| --- | --- | --- |
| 1 | 1.000–6.000 s | speaker_0 (A de referencia local) |
| 2 | 14.000–20.000 s | speaker_1 (B de referencia local) |
| 3 | 27.000–30.000 s | speaker_2 (C, grupo adicional por comprobar) |
| 4 | 48.000–53.000 s | speaker_2 (segunda muestra del mismo grupo algorítmico) |

Salida final: `{"lab":"VOICE-01I","ok":true,"clips_played":4,"files_written":0,"microphone_enabled":false,"identity_confirmed":false}`; mensaje de PowerShell: `VOICE-01I: reproduccion completada.`

El wrapper no generó nuevos archivos ni abrió el micrófono según los campos de estado. Esto es coherente con el diseño de reproducción en memoria mediante `winsound.PlaySound`, pero no comprueba por sí solo el contenido perceptual de cada clip ni la identidad de hablantes.

## Incidencia anterior resuelta

La primera ejecución física de VOICE-01I falló en el primer clip con `AttributeError: module 'winsound' has no attribute 'SND_SYNC'`. Se corrigió en `34b0f2b6`, utilizando `winsound.SND_MEMORY` sin la bandera inexistente; en `8efd405d` se añadió regresión de la ruta Windows con simulación de `winsound` sin `SND_SYNC`. La **segunda ejecución real en ASUS** reprodujo 3+4 clips con `ok:true`.

## Preguntas pendientes para cierre perceptual

Se requiere interpretación humana explícita, no deducción automática a partir de `clips_played`:

- **Audio 2:** ¿C (clip 3) tiene la voz de A (clip 1), de B (clip 2), de una tercera persona, o es indeterminado?
- **Audio 3:** ¿C (clip 3) y D (clip 4) se parecen entre sí y a cuál de las voces A/B se parecen, o suenan como una voz distinta/indeterminada?
- **Solapamiento VOICE-01H:** 17.817–18.627 s (`speaker_0`) y 18.374–21.142 s (`speaker_1`) tienen un solapamiento anotado por el algoritmo de 0.253 s; falta escucha focalizada del audio original entre ~17.5–19.5 s para verificar si hubo simultaneidad real.

**No marcar como PASS la atribución de voz por ahora.** Las etiquetas `speaker_0`, `speaker_1`, `speaker_2` solo son clusters locales por archivo, no identidades biométricas. Para DER formal hacen falta anotaciones completas con límites y silencios; el resultado actual no las aporta.

## Próximo gate

Interpretar el juicio de escucha de una persona, documentar dudas y, si fuese necesario, repetir solo uno o dos fragmentos a volumen seguro. Preparar anotaciones RTTM independientes de manera privada antes de afirmar calidad de diarización o modificar parámetros. No tocar LUMIA en vivo, Kokoro, Whisper, Qwen, launchers, permisos ni `main`; PR #79 continúa en borrador.

Seguimiento: [issue #78](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/issues/78), [PR #79](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/79), [QA VOICE-01H](QA-ASUS-VOICE01H-20261111.md).
