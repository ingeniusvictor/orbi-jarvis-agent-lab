## Identificación y problema
- **ID registrado en [LUMIA_IMPROVEMENTS_LEDGER.json](../LUMIA_IMPROVEMENTS_LEDGER.json):** `LUM-...`
- **Issue/decisión:** #
- **Problema observable y criterio de aceptación:**

## Una LUMIA / tres perfiles
**Misma base de código y versión:** sí / pendiente de justificar
- [ ] ASUS · GPU 4 GB · Qwen 3.5 2B Q4_K_M
- [ ] HP · GPU 6 GB · Qwen 3.5 4B candidato, 2B fallback, Nemotron experimental
- [ ] CPU · 0 GB VRAM · Qwen 3.5 0.8B propuesto

**Estado de cada perfil (no equiparar CI con QA física):**
| Perfil | Modelo exacto | SHA probado | CI | Prueba real | Bloqueos |
| --- | --- | --- | --- | --- | --- |
| ASUS 4 GB | | | | No probada | |
| HP 6 GB | | | | No probada | |
| CPU sin VRAM | | | | No probada | |

## Preservación de mejoras
- [ ] Ruta webcam/JPEG autorizado y MediaPipe facial (1 y 2 rostros) no regresan
- [ ] VI-05 postura sentada/brazos visibles fuera de encuadre sin inventar posición
- [ ] Voz Whisper/Kokoro y avatar VRM/R8 no regresan
- [ ] Cámara y micrófono no se activan sin permiso; sesión y workers terminan correctamente
- [ ] Sin fotografía, embedding, keypoints, RTSP secretos u otros datos personales en logs/repositorio
- [ ] Ninguna función se desactiva o cambia de cerebro silenciosamente en otro equipo

## Evidencia y decisión
- **CI acumulativa:** URL y resultado
- **Prueba de campo:** equipo, modelo Ollama, versión SHA, resultado, problemas y fechas
- **Rollback reversible:**
- **Entrada del registro actualizada:** sí / no
- **Autorización expresa del propietario para producción:** NO (por defecto)

> Si algo está pendiente, dejar la casilla sin marcar y anotarlo. Un PR DRAFT o CI verde **no constituye una versión liberada**. No tocar la instalación protegida ASUS ni hacer merge a main sin permiso explícito.
