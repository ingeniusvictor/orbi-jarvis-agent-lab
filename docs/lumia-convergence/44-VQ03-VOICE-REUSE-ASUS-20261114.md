# LUMIA VQ-03.3 — Whisper + Kokoro originales en clon QA (14-11-2026)

**Estado:** experimento aislado PR #83. NO instalado en LUMIA-ASUS principal. No transferir sin pruebas reales.

## Evidencia de la ASUS VQ-03 (01:xx)

El propietario pegó el arranque:
```text
bridge [lumia] voice runtime STT local->browser · TTS local->system · profile lumia-kokoro
bridge [lumia] local voice Whisper not ready · Kokoro not ready
bridge [lumia] Kokoro missing: python, model, voices
bridge [lumia] local model qwen3.5:2b-q4_K_M
bridge [lumia] Ollama ready · qwen3.5:2b-q4_K_M installed
bridge [lumia] chat warm-up completed · qwen3.5:2b-q4_K_M · 5.5s
```

**Interpretación exacta:** el clon QA reconoce el perfil solicitado `lumia-kokoro`, pero los recursos físicos NO están en las rutas por defecto. Whisper cae a **reconocimiento del navegador** y Kokoro a **voz del sistema**. Los logs previos de «primer audio 92–429 ms» en VQ-03 no certifican latencia Kokoro. El Qwen 2B sí está activo. El mensaje «browser control unavailable» es del control del navegador con extensión Claude y **no está relacionado** con STT ni TTS; no bloquear el arreglo de voz por eso.

## Causa confirmada en código

`bridge/orbia/local-voice-probe.mjs` usa `process.cwd()/.local-runtime` como base si las variables `ORBI_LOCAL_STT_*` y `ORBI_LOCAL_TTS_*` no están establecidas. Un `git clone` nuevo no tiene el contenido privado ignorado de `.local-runtime`.

`bridge/orbia/local-stt.mjs` y `local-tts.mjs` **sí aceptan rutas absolutas**. El TTS residente `resident-tts.mjs` ejecuta el adaptador `resident.py` de QA con la Python original, pero recibe los pesos mediante variables de entorno. El TTS de respaldo `synthesize.py` deriva su carpeta de pesos a partir de la ubicación de ese script, de modo que la nueva ruta de Python + script apunta al origen protegido y mantiene sus modelos.

## Solución VQ-03.3: referencia no destructiva al runtime existente

**Archivo:** `scripts/lumia-vq03-local-voice-qa.mjs`.

- Desde `LUMIA-VQ03-QA`, comprueba que `LUMIA-ASUS` está en el SHA protegido `1580a51`, que el clon tiene la rama VQ-03 y no hay cambios Git locales sin revisar.
- Invoca el gate de **1 VRM + 17 FBX** sin copiarlos.
- Comprueba archivos **multilingües** Whisper (ejecutable y `ggml-base.bin` o `ggml-small.bin`), Python original, script Kokoro original, pesos ONNX y voces (sin instalar ni copiar).
- Construye un **entorno de variables SOLO para el proceso hijo** que apunta a esos archivos originales. No toca variables globales de Windows ni altera lanzadores diarios, symlinks, códigos de LUMIA-ASUS o pesos.
- Comprueba preparación mediante `probeLocalVoiceCapabilities`: es una prueba **de existencia**, no una ejecución real de STT/TTS. Si falta un componente, se detiene y señala solo el nombre, no una ruta privada.
- Solo tras todo lo anterior llama al lanzador experimental `INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd`, manteniendo Qwen 2B, VQ-03.1/03.2 y Motion R8.
- No dar por CERTIFICADA la voz por ver los paths; hacen falta captura Whisper real, reproducción Kokoro y medición de pausas. No lanzar 2 LUMIA a la vez; cerrar sesiones desde su propio terminal Ctrl+C. No automatizar acceso permanente al micrófono ni habilitar escrituras al equipo.

**No ejecutar `INSTALAR_VOZ_LOCAL_LUMIA.cmd` dentro del clon ni duplicar `.local-runtime` sin razón.** El clon reutiliza en lectura los activos existentes; el proceso Python puede usar cachés propios de usuario, y se solicita `PYTHONDONTWRITEBYTECODE=1` para evitar generar bytecode en el script original.

## Paso a paso en ASUS: después de CI Windows/Linux PASS

En PowerShell normal, cerrar primero el laboratorio anterior y asegurarse de que 5173 y 8787 no estén ocupados. **No tocar ni cerrar Ollama**.

```powershell
$ErrorActionPreference = 'Stop'
$original = Join-Path $env:USERPROFILE 'LUMIA-ASUS'
$qa = Join-Path $env:USERPROFILE 'LUMIA-VQ03-QA'
$rama = 'feature/lumia-vq03-vrm-intent-clarity-20261113'

$sha = (& git -C $original rev-parse HEAD).Trim()
if ($sha -ne '1580a5182eba540893e35e37065be77da4ed014c') {
  throw 'No coincide el baseline de la ASUS. Detener.'
}
if ((& git -C $qa branch --show-current).Trim() -ne $rama) {
  throw 'Rama QA incorrecta.'
}
if (@(git -C $qa status --porcelain).Count -gt 0) {
  throw 'El clon tiene cambios locales. No actualizar.'
}
$busy = @(Get-NetTCPConnection -LocalPort 5173,8787 -State Listen -ErrorAction SilentlyContinue)
if ($busy.Count -gt 0) { $busy | Select-Object LocalPort,OwningProcess; throw 'Puertos ocupados.' }

git -C $qa fetch origin "refs/heads/$rama"
if ($LASTEXITCODE -ne 0) { throw 'Falló fetch.' }
git -C $qa merge --ff-only FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'No hubo fast-forward seguro.' }

# Verificar aquí SHA final aprobado por CI y documentado en PR #83.
git -C $qa rev-parse HEAD
Push-Location $qa
try {
  node .\scripts\lumia-vq03-local-voice-qa.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Prueba QA voz falló.' }
} finally { Pop-Location }
```

**Verificar en terminal:** ahora esperamos `STT local->local · TTS local->local` y `Whisper ready · Kokoro ready`, seguido de un mensaje de precalentamiento de Kokoro residente si logra cargar. Si sale `local->browser` o `local->system`, el gate físico de voz **FALLÓ** y no se comparan tiempos.

**Prueba real corta:** activar voz intencionalmente (botón UI; sin micrófono automático); decir «Lumi, hola, dime una frase corta sobre animaciones VRM». Verificar que el diagnóstico señale `whisper-local`, y escuchar un fragmento real `kokoro-local-resident` o `kokoro-local` si el diagnóstico/backend lo expone. Medir primer texto, primer audio y pausas por fragmento. Confirmar modo con el estado `voz` en el bridge; la etiqueta solicitada `profile lumia-kokoro` no basta. Después cerrar con Ctrl+C.

**Lo que NO comprueba el test:** performance estable de la ASUS diaria, voz natural y ausencia de alucinaciones Whisper en ambiente ruidoso, identidad de personas, animaciones de brazos por sí mismas, backups de modelos (LM-01 sigue siendo respaldo parcial). No promover MASTER sin QA real y comparar con baseline en turnos equivalentes.
