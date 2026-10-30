# LUMIA NF-01 — Priorizar voces cercanas en la ASUS (modo experimental)

## Problema observado
En una casa con otras personas, televisión o voces cercanas de fondo, Whisper recibe demasiado audio y puede transcribir frases ajenas o atribuirlas a la solicitud actual. El usuario quiere que LUMIA atienda a quien le habla directamente, también a su esposa, sin exigir una habitación silenciosa.

## Diagnóstico técnico
Chrome solicita cancelación de eco y supresión de ruido pero también ganancia automática `autoGainControl: true`. Esta última puede elevar voces distantes. El VAD original usa un disparo relativo al suelo de ruido por energía acústica: no sabe quién está hablando y por sí solo no separa dos voces simultáneas. La Voice Gate existente sigue en modo observación y sus perfiles de hablante no están vinculados al comando en caliente.

## Cambio NF-01 (solo lanzador ASUS, flag reversible)
- `VITE_LUMIA_NEAR_FIELD_FOCUS=1` solicita `autoGainControl: false` sin desactivar `noiseSuppression` ni `echoCancellation`.
- Eleva el disparo acústico de WAKE 25 % respecto al umbral previo y solicita una activación sostenida de 170 ms frente a 110 ms. En COMMAND eleva solo 8 %, para conservar voz suave y preguntas largas. GUARD conserva su protección antieco.
- No cambia expresiones de activación, identificación de hablante ni el modelo. La esposa puede seguir despertando a LUMIA igual que cualquier otra persona.
- El panel D muestra modo opt-in, AGC REAL si el navegador lo expone, RMS del micrófono, piso acústico y umbral de disparo. No se guardan nuevas muestras ni registros de audio.
- El modo por defecto fuera del ASUS no cambia. Para revertir se sustituye `set "VITE_LUMIA_NEAR_FIELD_FOCUS=0"` en el lanzador y se reinicia. Puede resultar necesario ajustar micrófono físico/volumen de entrada de Windows si Chrome ignora AGC o si el hablante está alejado.

## Limitaciones, próximas mediciones
Esta es mitigación de sensibilidad acústica, NO diarización ni identificación real de voces. Una voz de fondo fuerte también puede pasar el umbral, mientras que una pregunta suave y lejana puede quedar sin capturar. Para separación fiable se necesita micrófono direccional, pruebas calibradas en la misma habitación o un speaker-embedding autorizado, con opción de varios hablantes y sin perfil exclusivo por defecto.

Pruebas físicas: 1) una persona dice Lumi a distancia normal; 2) esposa dice Lumi y pregunta; 3) conversación de fondo/TV durante WAKE; 4) pregunta larga con conversación de fondo; 5) sin ruido, comprobar que Whisper no pierda consonantes iniciales. Registrar falsas activaciones, segmentos COMMAND aceptados y RMS/umbral; comparar apagando NF-01 con las mismas condiciones.
