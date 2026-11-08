# AMR-02.3 — reproducible *manual* Ollama vision benchmark from a single local photo.
# Nothing is uploaded outside localhost, stored on disk, or changed in Ollama.
# Run: .\scripts\benchmark-lumia-amr023-vision.ps1 -ImagePath "C:\ruta\foto.jpg"
param(
    [Parameter(Mandatory=$true)][string]$ImagePath,
    [string]$Model = 'qwen3.5:4b-vision4096',
    [string]$Question = 'Describe exactamente lo que aparece en esta imagen y di qué no puedes distinguir.'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $ImagePath).Path
$sourceFile = Get-Item -LiteralPath $sourcePath
if ($sourceFile.Length -le 0 -or $sourceFile.Length -gt 12MB) {
    throw 'La foto original debe ocupar entre 1 byte y 12 MB, igual que en LUMIA.'
}

# Do not touch the tested model, its Modelfile, keep-alive or GPU split.
ollama show $Model *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Modelo no instalado en Ollama: $Model"
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } |
    Select-Object -First 1
if (-not $jpegCodec) { throw 'No hay codificador JPEG instalado.' }

$qualityParams = [System.Drawing.Imaging.EncoderParameters]::new(1)
$qualityParams.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality, [long]76)

$results = @()
try {
    # Load only one owner-selected photo; no camera is opened.
    $original = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        if ($original.Width * $original.Height -gt 100000000) {
            throw 'Dimensiones originales superiores al limite admitido por LUMIA.'
        }
        foreach ($edge in @(512,768,1024)) {
            $scale = [Math]::Min(1.0,$edge / [double][Math]::Max($original.Width,$original.Height))
            $width = [Math]::Max(1,[int][Math]::Round($original.Width*$scale))
            $height = [Math]::Max(1,[int][Math]::Round($original.Height*$scale))
            $bitmap = [System.Drawing.Bitmap]::new($width,$height)
            $encoded = $null
            try {
                $gfx = [System.Drawing.Graphics]::FromImage($bitmap)
                try {
                    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $gfx.Clear([System.Drawing.Color]::White)
                    $gfx.DrawImage($original,0,0,$width,$height)
                } finally {
                    $gfx.Dispose()
                }
                $memory = [System.IO.MemoryStream]::new()
                try {
                    $bitmap.Save($memory,$jpegCodec,$qualityParams)
                    $encoded = [Convert]::ToBase64String($memory.ToArray())
                } finally {
                    $memory.Dispose()
                }
            } finally {
                $bitmap.Dispose()
            }
            if (-not $encoded -or $encoded.Length -gt 2000000) {
                throw "El JPEG de $edge px excede el limite de imagen de LUMIA."
            }
            $body = @{
                model=$Model; stream=$false; think=$false; keep_alive='30m'
                messages=@(
                    @{role='system';content='Describe observaciones visuales; distingue hipótesis. Responde en español con frases breves, sin inventar detalles.'}
                    @{role='user';content=$Question;images=@($encoded)}
                )
                options=@{temperature=0;num_ctx=4096;num_predict=256}
            } | ConvertTo-Json -Depth 8

            Write-Host "`n=== RESOLUCION $edge px · $width x $height ==="
            try {
                $r=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/chat' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
                $row=[pscustomobject]@{
                    LimitePx=$edge
                    Dimensiones="$width x $height"
                    TokensEntrada=$r.prompt_eval_count
                    EntradaS=[Math]::Round($r.prompt_eval_duration/1e9,2)
                    GeneracionS=[Math]::Round($r.eval_duration/1e9,2)
                    TotalS=[Math]::Round($r.total_duration/1e9,2)
                    Fin=$r.done_reason
                }
                $results+= $row
                Write-Host "Respuesta: $($r.message.content)"
                Write-Host "Entrada: $($row.TokensEntrada) tokens; $($row.EntradaS)s; total: $($row.TotalS)s; fin: $($row.Fin)"
            } catch {
                Write-Warning "Falló la consulta visual a $edge px: $($_.Exception.Message)"
                # Keep the next comparison independent, never auto-change model.
            }
            # No JPEG bytes are retained across benchmark iterations.
            $encoded=$null
        }
    } finally {
        $original.Dispose()
    }
} finally {
    $qualityParams.Dispose()
}
Write-Host "`n=== COMPARACION DE RESOLUCIONES (UNA FOTO / MISMA PREGUNTA) ==="
$results | Format-Table -AutoSize
Write-Host "Comparar tambien la exactitud visual de cada respuesta; menos tiempo no siempre significa mayor calidad."
