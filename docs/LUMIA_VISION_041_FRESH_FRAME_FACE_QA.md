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

## Incidente real: worktree nuevo muestra GLB antiguo (13-11-2026)

**Síntoma reportado por el propietario:** al iniciar el entorno aislado `LUMIA-VISION041-QA` se abrió la apariencia vieja GLB, sin las animaciones VRM/R8. **No atribuirlo a regresión del avatar hasta descartar recursos privados ausentes.**

**Causa arquitectónica verificada en código (presencia local pendiente):**

- `.gitignore` excluye `public/models/lumia-motion/*.vrm` y `public/models/lumia-motion/clips/`. Git `worktree add` **solo materializa archivos controlados por Git**, no los privados ignorados del checkout ASUS.
- `LumiaPortalHead.tsx` carga `/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm` y `portal-body-companion.ts` carga los 17 FBX indicados por el catálogo.
- `Scene.tsx` muestra `LumiaAvatar` (GLB antiguo) como fallback durante suspense, o cuando falla el VRM, registrando `[lumia:ph01] VRM Head failed; restoring legacy GLB`. Esta vía explica directamente el síntoma observado. No se han revisado aún los archivos del equipo del propietario ni se puede descartar una pestaña/servidor antiguo en los puertos 5173/8787.

**Corrección implementada:** `scripts/lumia-private-avatar-assets.mjs` introduce preflight local de **1 VRM + 17 FBX**, coteja hashes SHA256 en copias existentes y permite copiar solo tras `--copy --from`. No sobrescribe archivos, cambia pesos, inicia cámara/micrófono, abre red ni guarda material privado en Git. El lanzador VI-04.1 ahora se detiene ANTES de arrancar si faltan estos recursos. La copia es opcional y local, **solo hacia el worktree de QA**; el original no se modifica.

### Recuperación controlada desde PowerShell

Cerrar primero el terminal de la instancia experimental con Ctrl+C, sin terminar por fuerza Ollama ni procesos ajenos. Abrir PowerShell normal (no administrador), copiar:

```powershell
$original = Join-Path $env:USERPROFILE "LUMIA-ASUS"
$qa = Join-Path $env:USERPROFILE "LUMIA-VISION041-QA"
$rama = "feature/lumia-vi041-fresh-frame-face-audit-20261113"

if (-not (Test-Path $original -PathType Container) -or
    -not (Test-Path $qa -PathType Container)) {
    throw "No estan ambas carpetas. No se modifica ninguna."
}

$raizOriginal = (Resolve-Path -LiteralPath $original).Path
$raizQA = (Resolve-Path -LiteralPath $qa).Path
if ($raizOriginal -ieq $raizQA) { throw "Las carpetas no pueden coincidir." }

$repoOriginal = git -C $raizOriginal rev-parse --show-toplevel
$repoQA = git -C $raizQA rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or
    (Resolve-Path -LiteralPath $repoOriginal).Path -ine $raizOriginal -or
    (Resolve-Path -LiteralPath $repoQA).Path -ine $raizQA) {
    throw "No son repositorios separados esperados."
}

$cambios = @(git -C $raizQA status --porcelain)
if ($LASTEXITCODE -ne 0 -or $cambios.Count -gt 0) {
    throw "Revisar cambios locales QA, no hacer merge."
}

git -C $raizQA fetch origin "refs/heads/$rama"
if ($LASTEXITCODE -ne 0) { throw "Fetch fallo." }
git -C $raizQA merge-base --is-ancestor HEAD FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw "La rama local no permite fast-forward." }
git -C $raizQA merge --ff-only FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw "Fast-forward fallo." }

Push-Location $raizQA
try {
    node .\scripts\lumia-private-avatar-assets.mjs --doctor --from $raizOriginal
    if ($LASTEXITCODE -ne 0) { throw "Doctor de assets fallo." }

    # Copia voluntaria local: 18 archivos privados, sin overwrite y SHA256.
    node .\scripts\lumia-private-avatar-assets.mjs --copy --from $raizOriginal
    if ($LASTEXITCODE -ne 0) { throw "Copia privada fallo, revisar diagnostico." }

    node .\scripts\lumia-private-avatar-assets.mjs --require
    if ($LASTEXITCODE -ne 0) { throw "Preflight de VRM/R8 fallo." }

    # Arranque opcional (solo si no hay otra LUMIA ocupando 5173/8787).
    & .\INICIAR_LUMIA_ASUS_VISION_AUDITORIA_VI041.cmd
} finally {
    Pop-Location
}
```

**Nota de privacidad:** los 18 archivos permanecen bajo el perfil Windows del propietario, en rutas ignoradas por Git. No se copian a repositorio remoto ni se publican. El reporte solo incluye cantidad de recursos y nombres de los que falten, sin imágenes ni contenido personal. No ejecutar Git add/commit sobre modelos privados.

**Si aún aparece GLB:** comprobar en consola del navegador el mensaje `[lumia:ph01]`, que la pestaña corresponde a la URL de Vite impresa por **el nuevo terminal** y verificar qué procesos escuchan 5173/8787. No borrar `dist/`, worktree o configuración privada a ciegas. Un `Ctrl+F5` solo después de confirmar la instancia puede eliminar la vista web anterior, sin tocar datos.

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

**Estado CI:** primer run [43542504075](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/actions/runs/43542504075) **PASS Windows y Linux**, incluidas pruebas VI-04.1, VI-04A y VI-03.2B, lint y build. Las pruebas son sintéticas sin cámara real; el estado CI del último commit se verificará por separado. **Estado ASUS:** pendiente. **MASTER:** la rama de auditoría [PR #81](https://github.com/ingeniusvictor/orbi-jarvis-agent-lab/pull/81) permanece separada; no agregar VI-04.1 a producción.
