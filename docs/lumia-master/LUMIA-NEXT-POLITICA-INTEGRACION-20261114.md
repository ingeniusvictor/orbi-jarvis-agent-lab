# LUMIA NEXT — una sola línea acumulativa para la ASUS

Fecha: 14-11-2026. Rama canónica de integración: `integration/lumia-asus-next-20261114`.
Propuesta de distribución: una única carpeta **`LUMIA-NEXT-QA`** para la versión acumulativa y **`LUMIA-ASUS`** intacta como rollback. La rama histórica `main` NO representa el runtime ASUS real; no hacer merge a `main` por costumbre.

## Por qué esta versión existe

Observación del propietario: «cada vez que mejoramos algo quedan en una rama experimental y después que queremos volver a seguir mejorando perdemos el hilo de esas mejoras». El mecanismo anterior separaba mejoras del avatar (#83) y visión (#82). El propietario ya aprobó visualmente VQ-04 y VQ-05.1, pero VI-04.1 aún debe probarse físicamente con cámara real.

### Fuentes integradas, y estado real

- BASE: `1580a5182eba540893e35e37065be77da4ed014c`, protected ASUS installation.
- Avatar: código de PR #83, HEAD de partida `3597c8bda31dfce6499e0a6fccfd3ada6cd2ec80`. VQ-04 parpadeo/micromirada y VQ-05.1 expresiones faciales **aprobadas visualmente por el usuario** en la ASUS. No afirmar QA integral de todos los FBX.
- Visión: código óptico de PR #82, HEAD `cc10843a5069393a1d29fef21f33d3505378953f`. Se conservaron las nueve rutas independientes, y el único conflicto compartido `src/App.tsx` se reconcilió manualmente, **reteniendo ambos**: `parseLumiaFaceActionVQ051` y `auditFreshSceneAtTurn`. El código de VI-04.1 tiene CI, no tiene aún QA de la webcam física.
- Pipeline: mismo Qwen 3.5 2B, mismos Whisper y Kokoro locales; captura de cámara únicamente previa autorización de su usuario; detector CPU detecta **rostros**, no identidades ni todas las personas.

Leer el manifiesto máquina `LUMIA_NEXT_MANIFEST.json` en la raíz. Estados de aprobación no deben inferirse de un CI PASS; se actualizan solo con pruebas aportadas por el dueño.

## Contrato del nuevo método de trabajo

1. **Un único punto de continuación:** antes de iniciar un módulo, leer NEXT, su manifiesto y su última ejecución de CI. La ASUS protegida no se modifica.
2. Las ramas experimentales siguen siendo útiles como espacio temporal, pero **no son el lugar desde donde retomar**. Cada PR aprobado debe integrarse a NEXT, pasar CI acumulativo y verificar que las funciones previamente aprobadas siguen activas.
3. **CI no equivale a realidad:** un desarrollo tiene estados `implementado`, `CI aprobado`, `QA física aprobada`, `integrado en NEXT`, `promovido a producción`. No omitir estados.
4. Solo habrá un **launcher NEXT** que active el avatar aprobado más los sensores ópticos de prueba. Vision y avatar usan un mismo React/Three Canvas, Qwen 2B y sesión de voz; no iniciar dos apps ni dos puertos al mismo tiempo.
5. **Registro de continuidad:** al cerrar cada prueba, escribir en `LUMIA_NEXT_MANIFEST.json` y MASTER (#80) qué cambió, qué se comprobó realmente, riesgos, revertencia y próximo paso. La rama `NEXT` es el único candidato para eventual promoción a ASUS.
6. **Promoción segura:** después de QA completa, backup y plan de rollback, solicitar autorización explícita antes de cambiar `LUMIA-ASUS`, `main`, borrado de carpetas, inscripción biométrica, retención de imágenes o automatismos sensibles.

## Primer arranque de NEXT en Windows — carpeta nueva

Requisitos: instalación ASUS intacta, clon previo `LUMIA-VQ03-QA` con remoto GitHub configurado, Node/Git y Ollama ya instalados. Cierra primero todos los servidores de LUMIA. Abrir PowerShell como usuario normal (sin administrador).

```powershell
$ErrorActionPreference = "Stop"
$original = Join-Path $env:USERPROFILE "LUMIA-ASUS"
$sourceQa = Join-Path $env:USERPROFILE "LUMIA-VQ03-QA"
$next = Join-Path $env:USERPROFILE "LUMIA-NEXT-QA"
$branch = "integration/lumia-asus-next-20261114"
$base = "1580a5182eba540893e35e37065be77da4ed014c"

if (!(Test-Path $original -PathType Container) -or !(Test-Path $sourceQa -PathType Container)) {
  throw "Faltan ASUS o VQ03 QA; no se modifica la instalación."
}
if ((& git -C $original rev-parse HEAD).Trim() -ne $base) {
  throw "ASUS original cambió; detener sin copiar."
}

if (!(Test-Path $next)) {
  # Clona el QA anterior como base LOCAL, no crea una carpeta en ASUS.
  & git clone --no-hardlinks $sourceQa $next
  if ($LASTEXITCODE -ne 0) { throw "Clone local falló." }

  # Restaurar remoto original de GitHub, no apuntar a VQ03 como servidor.
  $remote = (& git -C $sourceQa remote get-url origin).Trim()
  & git -C $next remote set-url origin $remote
  if ($LASTEXITCODE -ne 0) { throw "Remote no actualizado." }
  & git -C $next fetch origin "refs/heads/$($branch):refs/remotes/origin/$($branch)"
  if ($LASTEXITCODE -ne 0) { throw "Fetch de NEXT falló." }
  & git -C $next switch -c $branch --track "origin/$branch"
  if ($LASTEXITCODE -ne 0) { throw "Switch a NEXT falló." }
} else {
  if (!(Test-Path $next -PathType Container)) { throw "NEXT no es carpeta." }
  if ((& git -C $next branch --show-current).Trim() -ne $branch) {
    throw "La carpeta NEXT existente tiene otra rama. No sobrescribir."
  }
  if (@(& git -C $next status --porcelain).Count -gt 0) {
    throw "NEXT tiene cambios locales; revisar sin sobrescribir."
  }
  & git -C $next fetch origin "refs/heads/$branch"
  if ($LASTEXITCODE -ne 0) { throw "Fetch falló." }
  & git -C $next merge --ff-only FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { throw "Fast-forward falló." }
}

Push-Location $next
try {
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw "Dependencias QA incompletas." }
  & node .\scripts\certify-lumia-next-integration.mjs
  if ($LASTEXITCODE -ne 0) { throw "Contrato acumulativo no pasó." }

  # Los recursos privados NO están en Git y NO se publican.
  # Sólo copia a NEXT si faltan; usa SHA256 y rechaza colisiones.
  & node .\scripts\lumia-private-avatar-assets-vq03.mjs --copy --from $original
  if ($LASTEXITCODE -ne 0) { throw "Recursos VRM/FBX no preparados." }

  & node .\scripts\lumia-next-local-voice-qa.mjs
  if ($LASTEXITCODE -ne 0) { throw "Launcher NEXT falló." }
} finally {
  Pop-Location
}
```

**Importante:** `npm ci` instala solo en el clon NEXT; el descargador VI-04A puede traer una vez un detector público de rostros, no imágenes personales. La cámara no se abre sola. Whisper/Kokoro se usan por rutas del original, sin escribir en él. El ensayo todavía depende del PC real y no debe marcarse aprobado antes de ejecutarlo.

## QA óptica siguiente y verificaciones de regresión

1. Verificar en Chrome que el rostro Vita muestra VQ-04 y que «Lumi, pon cara de alegría» aplica VQ-05.1. Confirmar que no apareció el GLB anterior.
2. Autorizar explícitamente webcam en interfaz, activar `Visión` y `Detectar rostros · CPU`; primero 0 rostros y luego 1 adulto consentido. No usar menores ni identificación.
3. «Lumia, ¿qué estás viendo ahora?» debe usar JPEG reciente. En F12 buscar simultáneamente `[lumia:vision-vi032b]` (`route: live-fresh`, `attachedJPEG: true`) y `[lumia:vision-vi041]` (`face-presence-available` cuando corresponde); diferenciar rostros de personas y comparar visualmente.
4. Desactivar detector, revocar permiso y dejar caducar sesión de 180 segundos. No deben emitirse evidencias faciales o escenas «en vivo» antiguas; cerrar stream. Respuestas no visuales no deben disparar cámaras.
5. Probar en medio cuerpo una animación R8 habitual, una frase hablada corta con visemas y el regreso a vista rostro. Comprobar que 2B sigue seleccionado.
6. Reportar solo estados de consola y evaluación visual del usuario. No subir fotografías, nombres, embeddings, grabaciones ni logs sensibles al repo.

**Resultado esperado de la integración:** una sola LUMIA NEXT que tiene **avatar ya aprobado** y **visión pendiente de validación** sin retroceder de versión cada vez que cambiamos de módulo.
