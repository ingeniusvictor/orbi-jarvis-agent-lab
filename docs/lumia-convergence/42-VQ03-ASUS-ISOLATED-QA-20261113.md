# LUMIA VQ-03 — Prueba aislada ASUS sin perder la instalación principal

**Estado:** protocolo de instalación/prueba; la versión principal `LUMIA-ASUS` y el backup parcial LM-01 NO se modifican ni se reemplazan.
**Rama candidata:** `feature/lumia-vq03-vrm-intent-clarity-20261113`, PR #83 (DRAFT).
**Motivo:** corregir el secuestro de la pregunta técnica «VRM/VRAM animaciones fluidas» por el catálogo PH-04, y el error VRM avatar vs VRAM GPU, sin modificar Qwen 2B, Whisper, Kokoro ni las 17 animaciones.

## Por qué no usar el worktree anterior

Al crear una rama con `git worktree`, Git no copia `public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm` ni los 17 FBX excluidos en `.gitignore`. Si la escena no los encuentra, el runtime tiene un fallback al GLB antiguo, sin la presencia esperada. Este candidato **prohíbe** iniciar sin comprobar esos 18 archivos privados.

`scripts/lumia-private-avatar-assets-vq03.mjs` es una utilidad aislada: `--doctor` SOLO consulta recuentos; `--copy --from` copia voluntariamente **únicamente** el VRM/17 FBX desde la ASUS original a la carpeta de QA, sin sobrescribir; `--require` detiene el lanzador si falta algo. Las copias se cotejan con SHA-256. No subir/compartir estos recursos ni añadirlos a Git.

## Gate previo: ejecutar solo con PR #83 CI Win + Linux PASS

No usar el SHA candidato de este documento hasta confirmar por GitHub Actions la última revisión. Git no es un respaldo completo del runtime de voz.

## Preparación segura con PowerShell normal (NO administrador)

Cerrar con Ctrl+C la ventana de LUMIA actual y cualquier laboratorio que ocupe 5173/8787; no detener Ollama. En una ventana nueva de PowerShell:

```powershell
$ErrorActionPreference = "Stop"
$original = Join-Path $env:USERPROFILE 'LUMIA-ASUS'
$qa = Join-Path $env:USERPROFILE 'LUMIA-VQ03-QA'
$rama = 'feature/lumia-vq03-vrm-intent-clarity-20261113'

if (!(Test-Path -LiteralPath $original -PathType Container)) {
    throw 'No se encontró LUMIA-ASUS.'
}
if (Test-Path -LiteralPath $qa) {
    throw 'LUMIA-VQ03-QA ya existe: no se sobrescribirá.'
}

# El original queda intacto: no hay git checkout, pull, reset ni worktree.
$shaOriginal = (& git -C $original rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $shaOriginal -ne '1580a5182eba540893e35e37065be77da4ed014c') {
    throw 'La LUMIA original cambió; parar y revisar antes de hacer QA.'
}

$ocupados = @(Get-NetTCPConnection -LocalPort 5173,8787 -State Listen -ErrorAction SilentlyContinue)
if ($ocupados.Count -gt 0) {
    $ocupados | Select-Object LocalPort,OwningProcess
    throw 'Puertos ocupados: cerrar primero el terminal anterior de LUMIA con Ctrl+C.'
}

git clone --single-branch --depth 1 --branch $rama 'https://github.com/ingeniusvictor/orbi-jarvis-agent-lab.git' $qa
if ($LASTEXITCODE -ne 0) { throw 'No pudo clonarse el candidato.' }

Push-Location $qa
try {
    # Releer SHA para verificar que coincide con la revisión certificada.
    git rev-parse HEAD
    node .\scripts\lumia-private-avatar-assets-vq03.mjs --doctor --from $original
    if ($LASTEXITCODE -ne 0) { throw 'Falló el doctor del avatar.' }

    # Copia local voluntaria (18 VRM/FBX), sin sobrescritura; verifica SHA-256.
    node .\scripts\lumia-private-avatar-assets-vq03.mjs --copy --from $original
    if ($LASTEXITCODE -ne 0) { throw 'Falló la preparación de activos.' }

    node .\scripts\lumia-private-avatar-assets-vq03.mjs --require
    if ($LASTEXITCODE -ne 0) { throw 'Faltan recursos VRM/FBX.' }

    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación de paquetes de QA.' }

    & .\node_modules\.bin\tsx.cmd .\scripts\certify-lumia-vq03-vrm-clarity.ts
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba de comprensión VQ-03.' }

    & .\INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd
} finally {
    Pop-Location
}
```

**Importante:** comprobar el SHA de `git rev-parse HEAD` contra el SHA con CI verde del PR antes de considerar los resultados aprobados. El comando `npm ci` solo escribe dependencias en `LUMIA-VQ03-QA`; no instalar nuevos modelos Ollama ni ejecutar `voice:setup` durante esta prueba.

## Primera ronda: TEXTO, no voz

El nuevo clon **NO copia** `.local-runtime` de Whisper/Kokoro, ni debe afirmar que puede usar las mismas rutas que la ASUS. Para aislar VQ-03, introducir las consultas por texto y juzgar la respuesta escrita; no usar indicadores de voz/TTS de este clon para comparar contra LM-01.

| Ensayo | Entrada | Resultado esperado |
| --- | --- | --- |
| 1, positivo | «Lumi, ¿qué sabes tú acerca de los VRAM y cómo podemos hacer para que un VRM tenga animaciones fluidas?» | Explica cómo suavizar transiciones del **avatar VRM**; **NO** lista 17 animaciones como respuesta principal |
| 2, positivo | «Si quisiera hacer de una IA local el sistema nervioso que controla un VRM, ¿qué tendría que hacer?» | Describe IA de alto nivel → controlador → rig/FBX/IK/blendshapes; no habla de RAM de GPU |
| 3, negativo | «¿Cuánta VRAM dedicada necesita una GPU para animar un personaje?» | Aclara memoria gráfica; no reinterpreta como avatar VRM |
| 4, comando | «Lumi, salúdame» | Ejecuta gesto R8 `waving` si cargó; respuesta no inventa éxito |
| 5, vista | «Lumi, cambia a medio cuerpo» | Cambia el avatar de vista, NO el modelo Ollama |
| 6, catálogo | «Lumi, ¿cuáles son tus animaciones disponibles?» | Sigue respondiendo localmente sobre catálogo Motion R8 |
| 7, seguridad | «Lumi, no cambies el modelo» | No cambia el modelo |

Observar si el avatar se mueve de verdad y no solo dice «lo hice». No compartir imágenes personales ni audios. Solo anotar PASS/FAIL por pregunta, contenido relevante y tiempo del primer texto. Comprobar en el nuevo terminal la URL Vite (5173 si libre), no una pestaña antigua.

## Antes de cualquier QA de VOZ

El runtime de Whisper/Kokoro vive bajo la carpeta ignorada `.local-runtime` en la ASUS original; el clon **no** lo hereda. Primero certificar el test de texto. Después diseñar una prueba separada de voz que use **sus modelos locales autorizados y verificados** sin provocar descargas, sobreescrituras o falsos indicadores de rendimiento. La pausa Kokoro/WAV de 3114 ms medida en ASUS se analiza en un **experimento A/B posterior**, no dentro de VQ-03.

## Estado y política de promoción

- CI Windows/Linux: consultar PR #83 HEAD y su ejecución.
- QA texto ASUS: PENDIENTE.
- QA voz ASUS: PENDIENTE.
- Qwen 2B sigue siendo predeterminado; `LUMIA-ASUS` no se modifica; no fusionar PR #83 por CI solo.
- Si falta VRM/R8 se bloquea el launcher en lugar de mostrar el antiguo GLB. Si los 18 archivos están pero el render falla, revisar URL Vite, traza PH-01 y estructura del rig: no afirmar éxito por preflight.

**Rollback:** cerrar QA con Ctrl+C, volver a abrir `C:\Users\ingvm\LUMIA-ASUS\INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd`. El clon se conserva para diagnóstico, no borrarlo automáticamente.
