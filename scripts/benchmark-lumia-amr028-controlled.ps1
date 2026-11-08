# AMR-02.8 — local, owner-approved repeatable comparison of the SAME photo
# and EXACT same question at 768/1024, using the real LUMIA visual prompt.
# No camera, cloud, uploads, persistent JPEG, prompt/answer CSV or model edits.
# Example:
# .\scripts\benchmark-lumia-amr028-controlled.ps1 -ImagePath "C:\Fotos\grupo.jpg" -Cycles 3 -ExpectedTotal 8
param(
    [Parameter(Mandatory=$true)][string]$ImagePath,
    [ValidateRange(1,6)][int]$Cycles=3,
    [ValidateRange(1,30)][int]$ExpectedTotal=8,
    [string]$Question='Lumi, observa cuidadosamente esta fotografía. Cuenta las personas visibles de izquierda a derecha, incluyendo a quien esté delante del grupo. ¿Cuántas personas hay en total, cuántas están de pie y cuántas están agachadas?',
    [string]$SummaryCsv=''
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing

if ($Question.Trim().Length -lt 1 -or $Question.Length -gt 1200) {
    throw 'Pregunta invalida: debe tener entre 1 y 1200 caracteres.'
}

$photoPath=(Resolve-Path -LiteralPath $ImagePath).Path
$photo=Get-Item -LiteralPath $photoPath
if ($photo.PSIsContainer -or $photo.Length -le 0 -or $photo.Length -gt 12MB) {
    throw 'Elige una fotografia real de entre 1 byte y 12 MB.'
}
if ([System.IO.Path]::GetExtension($photoPath).ToLowerInvariant() -notin @('.jpg','.jpeg','.png','.bmp')) {
    throw 'El benchmark local System.Drawing admite JPG, PNG y BMP.'
}

$scriptPath=Join-Path $PSScriptRoot 'benchmark-lumia-amr028-prompt.ts'
$promptJson=& npx.cmd tsx $scriptPath $Question
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el prompt real de LUMIA. Ejecuta npm ci si faltan dependencias.' }
$config=($promptJson -join [Environment]::NewLine) | ConvertFrom-Json
if ($config.model -ne 'qwen3.5:4b-vision4096') {
    throw 'El benchmark no cambia el perfil de modelo certificado de ASUS.'
}

& ollama show $config.model *> $null
if ($LASTEXITCODE -ne 0) { throw 'Falta qwen3.5:4b-vision4096 en Ollama.' }

# We only send owner-selected JPEGs to 127.0.0.1. Not a cloud API.
$endpoint='http://127.0.0.1:11434/api/chat'
$encoder=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
if (-not $encoder) { throw 'No se encontro un codificador JPEG local.' }
$quality=[System.Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0]=[System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality, [long]76)
$frames=@{}
$rows=New-Object 'System.Collections.Generic.List[object]'

function Get-ExplicitPeopleTotal([string]$answer) {
    $plain=[regex]::Replace($answer.Normalize([System.Text.NormalizationForm]::FormD),'\p{Mn}','')
    $plain=$plain.ToLowerInvariant()
    $number='(?:[1-9]|1[0-9]|20|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)'
    $match=[regex]::Match($plain,'\b(?:veo|hay|son|aparecen|observo|distingo|cuento|se ven)\s+(?:un total de\s+)?(?:alrededor de\s+)?(?<num>'+$number+')\s+(?:figuras humanas|figuras|personas|hombres|mujeres|individuos)\b')
    if (-not $match.Success) { return $null }
    $value=$match.Groups['num'].Value
    $numbers=@{
        uno=1;una=1;dos=2;tres=3;cuatro=4;cinco=5;seis=6;siete=7
        ocho=8;nueve=9;diez=10;once=11;doce=12;trece=13;catorce=14
        quince=15;dieciseis=16;diecisiete=17;dieciocho=18;diecinueve=19;veinte=20
    }
    if ($numbers.ContainsKey($value)) { return [int]$numbers[$value] }
    return [int]$value
}

function Get-Median([double[]]$values) {
    if (-not $values -or $values.Count -eq 0) { return $null }
    $sorted=@($values | Sort-Object)
    $middle=[int][math]::Floor($sorted.Count/2)
    if ($sorted.Count % 2 -eq 1) { return [double]$sorted[$middle] }
    return ([double]$sorted[$middle-1]+[double]$sorted[$middle])/2
}

try {
    $source=[System.Drawing.Image]::FromFile($photoPath)
    try {
        if ($source.Width -le 0 -or $source.Height -le 0 -or
            ([long]$source.Width*[long]$source.Height) -gt 100000000) {
            throw 'Dimensiones originales no admitidas por LUMIA.'
        }
        foreach ($edge in @(768,1024)) {
            $scale=[math]::Min(1.0,$edge/[double][math]::Max($source.Width,$source.Height))
            $width=[math]::Max(1,[int][math]::Round($source.Width*$scale))
            $height=[math]::Max(1,[int][math]::Round($source.Height*$scale))
            $bitmap=[System.Drawing.Bitmap]::new($width,$height)
            try {
                $gfx=[System.Drawing.Graphics]::FromImage($bitmap)
                try {
                    $gfx.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $gfx.Clear([System.Drawing.Color]::White)
                    $gfx.DrawImage($source,0,0,$width,$height)
                } finally { $gfx.Dispose() }
                $stream=[System.IO.MemoryStream]::new()
                try {
                    $bitmap.Save($stream,$encoder,$quality)
                    $base64=[Convert]::ToBase64String($stream.ToArray())
                } finally { $stream.Dispose() }
            } finally { $bitmap.Dispose() }
            if (-not $base64 -or $base64.Length -gt 2000000) {
                throw ('JPEG local de '+$edge+' px excede el limite de LUMIA.')
            }
            $frames[$edge]=[pscustomobject]@{width=$width;height=$height;data=$base64}
        }

        Write-Host ''
        Write-Host 'AMR-02.8 | benchmark local de vision | una fotografia | pregunta constante'
        Write-Host ('Modelo: '+$config.model+' | ciclos: '+$Cycles+' | resultado conocido: '+$ExpectedTotal+' personas')
        Write-Host 'Orden alternado ABBA/BAAB; sin segundo analisis oculto, sin cambios de GPU.'
        Write-Host 'Las respuestas se muestran solo en esta consola; no se guardan por defecto.'

        $sample=0
        for ($cycle=1;$cycle -le $Cycles;$cycle++) {
            if ($cycle % 2 -eq 1) { $sequence=@(768,1024,1024,768) }
            else { $sequence=@(1024,768,768,1024) }

            foreach ($edge in $sequence) {
                $sample++
                $frame=$frames[$edge]
                $payload=@{
                    model=$config.model
                    stream=$false
                    think=$false
                    keep_alive=$config.keepAlive
                    options=@{
                        temperature=[double]$config.options.temperature
                        num_ctx=[int]$config.options.num_ctx
                        num_predict=[int]$config.options.num_predict
                    }
                    messages=@(
                        @{role='system';content=$config.system},
                        @{role='user';content=$config.request;images=@($frame.data)}
                    )
                } | ConvertTo-Json -Depth 10 -Compress

                Write-Host ''
                Write-Host ('Muestra '+$sample+'/'+($Cycles*4)+' | ciclo '+$cycle+' | '+$edge+' px | '+$frame.width+'x'+$frame.height)
                try {
                    $response=Invoke-RestMethod -Method Post -Uri $endpoint -Body $payload -ContentType 'application/json' -TimeoutSec 240
                    $answer=[string]$response.message.content
                    $total=Get-ExplicitPeopleTotal $answer
                    $score=if ($null -eq $total) { 'sin evaluar' }
                      elseif ($total -eq $ExpectedTotal) { 'correcto' } else { 'incorrecto' }
                    $cacheProp=$response.PSObject.Properties['prompt_eval_cached_count']
                    $cached='N/D'
                    if ($null -ne $cacheProp -and $null -ne $cacheProp.Value) {
                        $cached=[string]$cacheProp.Value
                    }
                    $row=[pscustomobject]@{
                        Ciclo=$cycle;Orden=$sample;Px=$edge;Ancho=$frame.width;Alto=$frame.height
                        TotalS=[math]::Round(([double]$response.total_duration)/1e9,3)
                        EntradaS=[math]::Round(([double]$response.prompt_eval_duration)/1e9,3)
                        GeneracionS=[math]::Round(([double]$response.eval_duration)/1e9,3)
                        TokensEntrada=[int]$response.prompt_eval_count
                        TokensCache=$cached;Conteo=$total;Validacion=$score
                        Fin=[string]$response.done_reason
                    }
                    [void]$rows.Add($row)
                    Write-Host ('Conteo: '+$(if ($null -eq $total) { 'sin evaluar' } else { [string]$total })+
                        ' | estado: '+$score+' | tiempo: '+$row.TotalS+'s | cache: '+$cached+' tokens')
                    Write-Host ('RESPUESTA LOCAL: '+$answer.Trim())
                } catch {
                    Write-Warning ('Fallo en '+$edge+' px, muestra '+$sample+': '+$_.Exception.Message)
                } finally {
                    # The encoded request exists only in process memory.
                    $payload=$null
                }
            }
        }
    } finally { $source.Dispose() }
} finally {
    $quality.Dispose()
    $frames.Clear()
}

Write-Host ''
Write-Host '=== RESULTADOS DE INFERENCIA REAL POR MUESTRA ==='
$rows | Format-Table Ciclo,Orden,Px,Ancho,Alto,TotalS,EntradaS,TokensEntrada,TokensCache,Conteo,Validacion,Fin -AutoSize

Write-Host ''
Write-Host '=== RESUMEN POR RESOLUCION (SOLO TOTALES EXPLICITOS) ==='
$summary=@()
foreach ($edge in @(768,1024)) {
    $group=@($rows | Where-Object { $_.Px -eq $edge -and $_.Fin -eq 'stop' })
    $known=@($group | Where-Object { $null -ne $_.Conteo })
    $correct=@($known | Where-Object { $_.Conteo -eq $ExpectedTotal })
    $summary+=[pscustomobject]@{
        Px=$edge;Completas=$group.Count;ConteosEvaluables=$known.Count
        ConteosCorrectos=$correct.Count
        MedianaTotalS=if ($group.Count) { [math]::Round((Get-Median ([double[]]@($group|ForEach-Object {$_.TotalS}))),3) } else { $null }
        MedianaEntradaS=if ($group.Count) { [math]::Round((Get-Median ([double[]]@($group|ForEach-Object {$_.EntradaS}))),3) } else { $null }
        CacheInformada=@($group | Where-Object { $_.TokensCache -ne 'N/D' }).Count
    }
}
$summary | Format-Table -AutoSize
Write-Host 'OJO: valida tambien de pie/agachados leyendo cada RESPUESTA LOCAL; el parser solo valida totales explicitos.'
Write-Host 'El JPEG local usa System.Drawing calidad 76; NO son los mismos bytes que Canvas del navegador.'
Write-Host 'No se ha demostrado una mejora general ni se han modificado pesos/modelo.'

if ($SummaryCsv.Trim()) {
    # Opt-in explicit: only numeric metadata, never image, path or answer text.
    $csv=[System.IO.Path]::GetFullPath($SummaryCsv)
    if (-not (Test-Path -LiteralPath (Split-Path -Parent $csv) -PathType Container)) {
        throw 'La carpeta de exportacion de resumen no existe.'
    }
    $rows | Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8
    Write-Host 'CSV de metricas numericas creado en la ruta indicada.'
}
