# AMR-02.9 — short, side-by-side local Qwen3.5 2B vs customised 4B trial.
# Written tasks + spoken-reply model contract + ONE image per model.
# Real microphone (Whisper) and playback (Kokoro) are compared separately
# through LUMIA's existing app; this CLI does NOT pretend to measure them.
# No automatic downloads, webcam, hidden captures or saved pictures/answers.
param(
    [Parameter(Mandatory=$true)][string]$ImagePath,
    [string]$Model2B='qwen3.5:2b',
    [string]$Model4B='qwen3.5:4b-vision4096',
    [ValidateSet(768,1024)][int]$Edge=768
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing

# Explicitly block arbitrary URLs and require two different installed tags.
if ($Model2B -eq $Model4B -or $Model2B -notmatch '^qwen3\.5:2b(?:[-._a-zA-Z0-9]*)?$' -or
    $Model4B -ne 'qwen3.5:4b-vision4096') {
    throw 'Este ensayo compara solo el Qwen3.5 2B instalado contra qwen3.5:4b-vision4096, sin sustituir perfiles.'
}
# Inspect the installed tags first: with ErrorActionPreference=Stop, redirecting
# stderr from 'ollama show' would terminate Windows PowerShell too early.
$inventory=@(& ollama list)
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo consultar Ollama local. Comprueba que el servicio esté funcionando.'
}
$installed=@($inventory | Select-Object -Skip 1 | ForEach-Object {
    ($_ -split '\s+')[0]
} | Where-Object { $_ })

if ($Model2B -notin $installed) {
    $candidates=@($installed | Where-Object {
        $_ -match '^qwen3\.5:2b(?:[-._a-zA-Z0-9]*)?$'
    })
    if ($Model2B -eq 'qwen3.5:2b' -and $candidates.Count -eq 1) {
        $Model2B=$candidates[0]
        Write-Host ('Se detectó Qwen 2B instalado con otra etiqueta: '+$Model2B)
    } else {
        Write-Host 'Modelos instalados:'
        $inventory | ForEach-Object { Write-Host $_ }
        if ($candidates.Count -gt 1) {
            throw 'Hay varios modelos 2B. Especifica el correcto con -Model2B (tag de ollama list).'
        }
        throw ('No se encontró '+$Model2B+' en Ollama. No se descargó ni modificó ningún modelo.')
    }
}
if ($Model4B -notin $installed) {
    Write-Host 'Modelos instalados:'
    $inventory | ForEach-Object { Write-Host $_ }
    throw ('No se encontró el 4B personalizado '+$Model4B+'. No se descargó ningún modelo.')
}
$models=@($Model2B,$Model4B)
$sourcePath=(Resolve-Path -LiteralPath $ImagePath).Path
$sourceInfo=Get-Item -LiteralPath $sourcePath
if ($sourceInfo.PSIsContainer -or $sourceInfo.Length -le 0 -or $sourceInfo.Length -gt 12MB) {
    throw 'La foto debe ser un archivo local de 1 byte a 12 MB.'
}
if ([System.IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -notin @('.jpg','.jpeg','.png','.bmp')) {
    throw 'Para este benchmark selecciona JPG, PNG o BMP.'
}

$cfgText=& npx.cmd tsx (Join-Path $PSScriptRoot 'benchmark-lumia-amr029-config.ts')
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron cargar las preguntas y el perfil de LUMIA.' }
$cfg=($cfgText -join [Environment]::NewLine) | ConvertFrom-Json
if ($cfg.model2B -ne 'qwen3.5:2b' -or $cfg.model4B -ne 'qwen3.5:4b-vision4096') {
    throw 'Perfil de comparación inesperado.'
}
$endpoint='http://127.0.0.1:11434/api/chat'
$encoder=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object {$_.MimeType -eq 'image/jpeg'} | Select-Object -First 1
if (-not $encoder) { throw 'No se encontró el codificador JPEG local.' }
$quality=[System.Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0]=[System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality, [long]76)
$rows=New-Object 'System.Collections.Generic.List[object]'
$frame=$null

try {
    $original=[System.Drawing.Image]::FromFile($sourcePath)
    try {
        if (($original.Width -le 0) -or ($original.Height -le 0) -or
            (([long]$original.Width*[long]$original.Height) -gt 100000000)) {
            throw 'Dimensiones de fotografía no válidas.'
        }
        $scale=[math]::Min(1.0,$Edge/[double][math]::Max($original.Width,$original.Height))
        $width=[math]::Max(1,[int][math]::Round($original.Width*$scale))
        $height=[math]::Max(1,[int][math]::Round($original.Height*$scale))
        $bitmap=[System.Drawing.Bitmap]::new($width,$height)
        try {
            $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.DrawImage($original,0,0,$width,$height)
            } finally { $graphics.Dispose() }
            $stream=[System.IO.MemoryStream]::new()
            try {
                $bitmap.Save($stream,$encoder,$quality)
                $jpeg=[Convert]::ToBase64String($stream.ToArray())
            } finally { $stream.Dispose() }
        } finally { $bitmap.Dispose() }
        if (-not $jpeg -or $jpeg.Length -gt 2000000) {
            throw 'La imagen preparada excede el máximo admitido por LUMIA.'
        }
        $frame=[pscustomobject]@{width=$width;height=$height;data=$jpeg}
    } finally { $original.Dispose() }

    Write-Host ''
    Write-Host '=== AMR-02.9 · QWEN3.5 2B vs 4B modificado, sin cambiar modelos ==='
    Write-Host ('Fotografía: '+$frame.width+' x '+$frame.height+' · mismo JPEG para ambos')
    Write-Host 'Tres tareas de texto / respuesta hablable y una imagen por modelo.'
    Write-Host 'La tarea VOZ-MODELO solo compara la respuesta que Kokoro leería.'
    Write-Host 'Whisper, Kokoro y audio real se prueban después desde la interfaz de LUMIA.'
    Write-Host 'No se guardan imágenes, preguntas, respuestas ni resultados.'

    foreach ($task in $cfg.tasks) {
        Write-Host ''
        Write-Host ('========== '+$task.id.ToUpperInvariant()+' ==========')
        if ($task.kind -eq 'image') {
            Write-Host ('Pregunta: '+$cfg.visualQuestion)
        } else {
            Write-Host ('Pregunta: '+$task.question)
        }
        foreach ($model in $models) {
            $isVisual=$task.kind -eq 'image'
            $system=if ($isVisual) { [string]$cfg.visualSystem } else { [string]$cfg.system }
            $userMessage=@{role='user';content=[string]$task.question}
            if ($isVisual) {$userMessage.images=@($frame.data)}
            $payload=@{
                model=$model
                stream=$false
                think=$false
                keep_alive=[string]$cfg.keepAlive
                messages=@(
                    @{role='system';content=$system}
                    $userMessage
                )
                options=@{
                    temperature=[double]$cfg.options.temperature
                    num_ctx=[int]$cfg.options.num_ctx
                    num_predict=[int]$task.numPredict
                }
            }
            if ($task.kind -eq 'speech-ready') {$payload.format=$cfg.format}
            $json=$payload | ConvertTo-Json -Depth 12 -Compress
            $body=[System.Text.Encoding]::UTF8.GetBytes($json)
            $watch=[System.Diagnostics.Stopwatch]::StartNew()
            Write-Host ('Modelo: '+$model)
            try {
                $r=Invoke-RestMethod -Uri $endpoint -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 240
                $watch.Stop()
                $raw=[string]$r.message.content
                $answer=$raw.Trim()
                if ($task.kind -eq 'speech-ready') {
                    try {
                        $parsed=$raw | ConvertFrom-Json
                        if ($null -ne $parsed -and $null -ne $parsed.respuesta) {
                            $answer=[string]$parsed.respuesta
                        } else { $answer='[JSON sin respuesta] '+$raw }
                    } catch { $answer='[JSON no válido] '+$raw }
                }
                $cacheProp=$r.PSObject.Properties['prompt_eval_cached_count']
                $cache='N/D'
                if ($null -ne $cacheProp -and $null -ne $cacheProp.Value) {
                    $cache=[string]$cacheProp.Value
                }
                $loadSec=[math]::Round(([double]$r.load_duration)/1e9,3)
                $totalSec=[math]::Round(([double]$r.total_duration)/1e9,3)
                $row=[pscustomobject]@{
                    Prueba=[string]$task.id
                    Modelo=$model
                    ParedS=[math]::Round($watch.Elapsed.TotalSeconds,3)
                    OllamaS=$totalSec
                    CargaS=$loadSec
                    SinCargaS=[math]::Round(($totalSec-$loadSec),3)
                    EntradaS=[math]::Round(([double]$r.prompt_eval_duration)/1e9,3)
                    SalidaS=[math]::Round(([double]$r.eval_duration)/1e9,3)
                    TokensEntrada=[int]$r.prompt_eval_count
                    TokensSalida=[int]$r.eval_count
                    Cache=$cache
                    Fin=[string]$r.done_reason
                }
                [void]$rows.Add($row)
                Write-Host ('Respuesta: '+$answer)
                Write-Host ('Ollama: '+$row.OllamaS+' s · carga: '+$row.CargaS+' s · sin carga: '+$row.SinCargaS+' s · cache: '+$row.Cache)
            } catch {
                $watch.Stop()
                Write-Warning ('Falló '+$task.id+' con '+$model+': '+$_.Exception.Message)
                [void]$rows.Add([pscustomobject]@{
                    Prueba=[string]$task.id;Modelo=$model
                    ParedS=[math]::Round($watch.Elapsed.TotalSeconds,3)
                    OllamaS=$null;CargaS=$null;SinCargaS=$null
                    EntradaS=$null;SalidaS=$null;TokensEntrada=$null
                    TokensSalida=$null;Cache='N/D';Fin='error'
                })
            } finally {
                $body=$null
                $json=$null
                $payload=$null
            }
        }
    }
} finally {
    $quality.Dispose()
    $frame=$null
}

Write-Host ''
Write-Host '=== COMPARACIÓN NUMÉRICA SIN CONTENIDO PRIVADO ==='
$rows | Format-Table Prueba,Modelo,OllamaS,CargaS,SinCargaS,EntradaS,SalidaS,TokensSalida,Cache,Fin -AutoSize

Write-Host ''
Write-Host 'LECTURA DE CALIDAD:'
Write-Host '- Texto simple: comprobar claridad y brevedad.'
Write-Host '- Razonamiento: la diferencia correcta es (10-8)/10*100 = 20%, más acción segura.'
Write-Host '- Voz-modelo: comprobar si da dos frases útiles; NO mide Whisper/Kokoro.'
Write-Host '- Imagen: comprobar conteo, postura y alucinaciones en ambas respuestas.'
Write-Host '- Para voz REAL: abrir LUMIA con el mismo lanzador, seleccionar cada modelo en CEREBRO LOCAL,'
Write-Host '  decir EXACTAMENTE la misma pregunta VOZ-MODELO y compartir DIAGNÓSTICO DE CONVERSACIÓN.'
Write-Host '  El navegador permite ver primer texto, inicio de audio y fin de reproducción.'
Write-Host 'La columna CargaS mide recarga del modelo por Ollama; SinCargaS la excluye.'
