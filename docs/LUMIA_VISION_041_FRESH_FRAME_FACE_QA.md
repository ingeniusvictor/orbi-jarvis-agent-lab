# LUMIA VI-04.1 — Auditoría óptica por turno, sin reconocimiento personal

**Fecha:** 13-11-2026. Rama: `feature/lumia-vi041-fresh-frame-face-audit-20261113`.
**Tipo:** piloto opt-in / laboratorio VISIÓN en LUMIA, NO release MASTER.

## Por qué existe

Se observaron en ASUS respuestas de Qwen 2B que omitían figuras visibles o describían una escena antigua. El código VI-03.2B captura un **JPEG nuevo por pregunta** mientras la visión activa está autorizada; VI-04A tiene un detector **CPU** que cuenta **rostros**, no personas ni identidades. Sin correlación temporal entre ambas mediciones, un contador de dos rostros de hace varios segundos no permite corregir una descripción de otra escena.

**Meta acotada:** demostrar de forma independiente para cada consulta visual que hubo un fotograma nuevo y, solo si el detector estaba activo y tenía muestra estable reciente del mismo stream, disponer del **número de rostros** en consola. El conteo NO se envía a Qwen y NO se altera ninguna respuesta, captura ni prompt.

## Cambios

- `src/lib/vision-audit-vi041.ts`: clasificador puro y determinista; una muestra de rostro solo se comunica si estaba confirmada por VI-04A, precede al JPEG y tiene un máximo de **3500 ms** al momento de la captura. Si el JPEG tiene más de **2000 ms** al momento de la evaluación, se marca `frame-aged` y no se adjunta el conteo. Las ventanas son **gates de diagnóstico, no garantías perceptivas**.
- `src/lib/vision-active-vi031.ts`: dos propiedades opcionales para referencia temporal del detector, sin guardar información biométrica.
- `src/ui/LumiaCameraViewfinder.tsx`: conserva únicamente `{count,observedAt}` mientras el detector habilitado tenga conteo **estable y sin transición**; borra la evidencia al cerrar sesión, cambiar cámara, fallar el detector o desactivar análisis. Reutiliza la misma cámara autorizada, sin abrir otra.
- `src/App.tsx`: solo bajo `VITE_LUMIA_VISION_QA_VI041=1` y flags heredados VI-03.2B/VI-04A imprime en Chrome DevTools el resumen `[lumia:vision-vi041]`: `status`, `frameAgeMs`, `faceCount`, `faceSampleAgeAtCaptureMs`, `faceEvidenceIsIdentity:false`, `cameraAutoOpened:false`.
- `INICIAR_LUMIA_ASUS_VISION_AUDITORIA_VI041.cmd`: arranque **voluntario** que hereda el piloto VI-04A → VI-03.2B → Sentinel → visión activa → AMR-03.0 (Qwen 2B). Es alternativo al lanzador diario; no ejecutarlos simultáneamente. VI-04A puede preparar una **descarga pública de BlazeFace** en el primer uso, nunca de imágenes personales.
- `scripts/certify-lumia-vision041-audit.ts` y CI Windows/Linux: falsos/verdaderos de edad temporal, cero caras, 1/2/8, muestra sin confirmación, permiso denegado, fechas inválidas, ventana de 3.5s, contrato de privacidad y conservación de las rutas previas.

## Significado de estados

| Estado | Lectura correcta |
| --- | --- |
| `camera-not-authorized` | No había sesión visual autorizada. No describe la escena. |
| `no-current-frame` | No se recibió un JPEG actual válido. |
| `frame-aged` | Hay JPEG, pero superó 2 s respecto al diagnóstico; no se aprovecha un rostro de otro momento. |
| `face-detector-off` | El propietario no activó el detector facial en la sesión. |
| `face-detector-unavailable` | Detector no ha estabilizado el conteo o presenta problema de modelo. |
| `face-detector-stale` | Conteo anterior, futuro/incompatible o fuera de ventana temporal. |
| `face-presence-available` | Número de **rostros** cercano en tiempo al JPEG; **no** equivale a número de personas y mucho menos a reconocimiento. |

## QA física ASUS (pendiente)

**NO cambiar el worktree `C:\Users\ingvm\LUMIA-ASUS`.** Cuando CI pase, preparar un worktree separado de la rama VI-04.1, con dependencias y assets necesarios, sin copiar material privado al repositorio. No publicar imágenes, nombres ni voz en GitHub ni compartirlas en el chat. Solo resultados de métricas.

1. Arrancar VI-04.1 (no AMR-03.0 a la vez), abrir Chrome/Edge normal, autorizar explícitamente la cámara, pulsar **Activar visión**, después **Detectar rostros · CPU**. No abre la cámara sola; la sesión dura como máximo 180 segundos.
2. Hacer 0 → 1 rostro adulto con consentimiento; opcionalmente 2 adultos con consentimiento, dentro del mismo encuadre. La UI debe estabilizar un contador tras 2 observaciones. No asumir que el detector detectará rostros girados, lejanos u ocultos.
3. Preguntar «Lumia, ¿qué estás viendo ahora?» y «Vuelve a revisar la escena». En Console buscar **dos trazas**: `[lumia:vision-vi032b]` con `attachedJPEG:true`, `route:live-fresh`; y `[lumia:vision-vi041]` con `status:face-presence-available` cuando el detector esté estable y reciente. Esperar `frameAgeMs<=2000` y `faceSampleAgeAtCaptureMs<=3500`.
4. Comparar la descripción audible de Qwen con lo que realmente muestra el visor y con el conteo de **rostros**. Si no coinciden, clasificar por separado: **fotograma no adjunto**, **detector no disponible**, **rostros sin correspondencia a personas**, **Qwen no reconoce figura**. El diagnóstico NO decide automáticamente quién tiene razón.
5. Desactivar detector: nuevas preguntas deben indicar `face-detector-off`; la visión puede continuar sin usar el contador. Cambiar cámara/finalizar sesión debe borrar la evidencia.
6. Dejar expirar los 180 segundos y preguntar de nuevo: debe rechazar la afirmación de visión en vivo, sin iniciar cámara/rostro por sí mismo; verificar en el navegador el permiso y la liberación del stream.
7. Probar pregunta no visual («Explícame un string fotovoltaico»): no generar traza VI-04.1 ni inferencia adicional. Verificar 2B, Whisper, Kokoro, avatar, temperaturas y carga CPU.
8. Cerrar sesión, liberar puertos; regresar al lanzador diario original. No hacer enrolamiento DPAPI ni usar fotos de menores.

**Resultados que necesitamos de ASUS:** tres grupos de líneas **anonimizadas** de consola (estado con detector OFF, ON y después de caducidad), número de rostros observable, si Qwen omitió alguna figura, y carga/latencia aproximada. No solicitar audios, imágenes ni nombre de personas.

## Límites de validez

- Detectar un **rostro visible** es distinto de contar **personas**, que pueden estar de perfil o de espaldas. Dos rostros en una escena no certifican que el VLM distinguió dos personas correctamente.
- El detector VI-04A en CPU es un laboratorio aún sin validación física integral; este gate no lo transforma en reconocimiento biométrico ni confirma identidad de conocidos.
- El conteo no se inyecta en Qwen para evitar contaminar la respuesta con evidencia imprecisa. Sin «ground truth» real revisado manualmente no se puede estimar precisión ni atribuir toda discrepancia al VLM.
- La relación temporal entre muestras no garantiza que las personas no se hayan movido entre ambas. Es un **diagnóstico provisional**, no sensor sincronizado hardware.
- El algoritmo no necesita red para procesar fotos ni mensajes; preparar el modelo público con el lanzador puede requerir red una única vez. No hay captura automática sin opt-in.

## Siguiente puerta

Si se confirma la relación temporal, diseñar VI-04.2 con un protocolo **verdaderamente sincronizado** de análisis semántico y test de casos de error, sin fusionar identidades. Si el detector falla en QA, corregir primero presencia VI-04A; no subir Qwen 4B por defecto para esconder el fallo.

**Estado CI:** pendiente de verificar en el commit final. **Estado ASUS:** pendiente. **MASTER:** la rama de auditoría [PR #81](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/81) permanece separada; no agregar VI-04.1 a producción.
