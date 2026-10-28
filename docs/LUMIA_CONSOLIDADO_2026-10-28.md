# L.U.M.I.A. — Consolidación del 28 de octubre de 2026

**Repositorio:** `ingeniusvictor/orbi-jarvis-agent-lab`  
**Rama de consolidación:** `feature/lumia-consolidated-release-20261028`  
**Protección:** `main` sin modificaciones ni fusiones; se conservan otras funcionalidades del antiguo Jarvis y los trabajos MI/Voice Gate.  
**Propósito:** reunir el código de LUMIA avanzado en las ramas experimentales y preparar la incorporación definitiva del rostro 3D facial del propietario.

## Funciones reunidas en esta rama

| Módulo | Base integrada | Situación |
|---|---|---|
| Identidad L.U.M.I.A. en español, cerebro Ollama y herramientas locales de lectura | Bases anteriores | En código |
| WHISPER.cpp local, Kokoro ONNX, perfiles de voz y diagnóstico de Windows | VL-06 / VRM | En código; binarios de runtimes locales NO versionados |
| Avatar 3D facial, efectos y movimiento reactivo al habla | AV-01/AV-01B, PR #20 | Calibración en código; GLB pendiente de publicación binaria |
| Cronología de conversación y métricas texto/voz | TL-01, PR #21 | En código |
| Motor Kokoro residente y síntesis anticipada | VA-01, PR #22 | En código, activación opcional |
| Mejoras de Whisper «IA local» y streaming seguro de Ollama | RC-01, PR #23 | En código, activación opcional |
| Detección de pausas entre frases, LLM / TTS / reproducción | RA-01, PR #24 | En código |
| Inventario real de modelos y seguimiento «¿cuáles son?» | MI-02, PR #25 | En código |
| Recuperación de preguntas perdidas al pasar de GUARD a espera | WR-01, PR #26 | En código |
| Visión multimodal: foto escogida → Ollama local → respuesta de LUMIA | VI-01, PR #27 | Código certificado; pendiente validación con la interfaz física |
| Avatar facial AV-01B (GLB privado 4.13 MB) | Este release | Hash y procedimiento de incorporación disponibles |

**Las pruebas CI validan contratos y compilación, no confirman por sí solas funcionamiento de micrófono, TTS, visión ni FPS en Windows.**

## Nuevo avatar: archivo identificado y verificado

En la conversación original se suministró `LUMIA solo rostro(1).glb`, y posteriormente un ZIP de instalación `LUMIA_Nuevo_Rostro_Instalacion_Windows.zip`. El GLB de ese ZIP contiene el marcador `nodes[0].extras.lumiaAvatarProfile = "face-v1"` compatible con `src/scene/avatar-profile.ts`.

- Ruta final: `public/models/lumia/lumia.glb`.
- Tamaño: **4.128.456 bytes**.
- SHA-256: `a1d48cb762fb00ecb2e89270ca7755b7ad7ac1e7e384e0cc21a796494418f56f`.
- Encuadre aprobado: `FACE_HEIGHT_FRACTION = 0.47`, `FACE_SHIFT_PX = 25`.
- El avatar es **solo rostro/busto**, no sustituye a un avatar de cuerpo completo riggeado.
- Conserva el buffer binario original de texturas y geometría.
- NO se confunde el GLB del rostro con `orbia-lumia:4b` ni con el motor de voz.

### Estado del GLB en GitHub

La conexión del asistente permite escribir archivos **de texto** en GitHub, no cargar directamente el GLB binario local. Por ello el archivo `lumia.glb` **no se da por publicado** hasta que un propietario ejecute la transferencia verificada desde Windows. Un `README` o un puntero Git LFS sin objeto remoto **no equivalen** a subir el avatar.

Se entrega un paquete ZIP comprobable con el GLB y un script `PUBLICAR_ROSTRO_AV01B_EN_GITHUB.ps1`, también versionado aquí. El script:

1. Confirma el hash SHA-256 exacto.
2. Crea un clon NUEVO y aislado de esta rama experimental.
3. Copia solo `public/models/lumia/lumia.glb`; no toca el proyecto original ni TL-01.
4. Realiza `git add -f` (la ruta aún aparece en `.gitignore`), `git commit` y `git push` exclusivamente a esta rama.
5. Requiere que Git en Windows tenga credenciales válidas para escribir en este repositorio.

La rama puede revisarse como PR en GitHub antes de cualquier fusión. **No fusionar con `main` sin auditoría y validación del propietario.**

## Equipos y modelos: NO mezclar configuraciones

**Ryzen 7 4700U:** solo CPU y `qwen3:1.7b` como candidato para conversación rápida; la carpeta original Windows posee la configuración de voz local, y la copia de pruebas está en `C:\ORBI CODEX\orbi-jarvis-agent-lab-TL01`.

**ASUS TUF:** i5-10300H, 32 GB RAM, GTX 1650 Ti 4 GB VRAM.
`qwen3.5:2b-q4_K_M` ejecutó una petición con imagen con `PROCESSOR 100% GPU` a ctx=4096 (23,57 segundos totales, 150 tokens a 73,43 tokens/s, 2345 MiB/4096 MiB de VRAM general). Este tiempo incluye evaluación visual y posible carga inicial. `qwen3.5:4b` funcionó pero quedó CPU/GPU compartido en ctx=4096 y ctx=2048, y no debe reemplazar automáticamente al 2B.

Para probar VI-01 se necesita una instalación LUMIA separada en ASUS y habilitar explícitamente:

```powershell
$env:VITE_LUMIA_VISUAL_INPUT_VI01 = '1'
$env:ORBIA_LUMIA_VISION_ENABLED = '1'
$env:JARVIS_OLLAMA_MODEL = 'qwen3.5:2b-q4_K_M'
$env:ORBIA_LUMIA_MODEL = 'qwen3.5:2b-q4_K_M'
npm run start:lumia
```

No habilitar visión en Ryzen hasta comprobar que allí existe un modelo multimodal apropiado y su coste de procesamiento.

## Próximas pruebas físicas

- Confirmar GLB con hash correcto descargado desde GitHub después del push; rostro centrado, expresión y baja emisión.
- Probar voz Whisper + Kokoro y reducir el retraso primera voz; no asumir que el cambio de modelo lo resuelve.
- Confirmar preguntas de seguimiento aceptadas por la máquina de estados; observar registro «COMANDO A O.R.B.I.A.».
- Ejecutar VI-01 en ASUS: seleccionar una fotografía, distinguir **hechos visibles** de **hipótesis** y registrar tiempos de procesamiento y primera voz.
- Mantener cámara y captura de pantalla desactivadas hasta implementar autorizaciones separadas y auditar uso de imágenes.

## Reglas de preservación

- `main` no se modifica.
- No cambiar el avatar GLB o el archivo `LumiaAvatar.tsx` localmente aprobado sin respaldo.
- No versionar modelos Ollama, claves, ejecutables Whisper/Kokoro ni `.local-runtime`.
- No sustituir ChatBox, otros subsistemas ORBIA o la instalación original sin autorización.
