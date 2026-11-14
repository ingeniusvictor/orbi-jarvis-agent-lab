# LUMIA VOICE-01H: new official public WAV holdout, offline only.
# Usage: .\labs\voice-01\validate-embeddings-holdout-asus.ps1 -DownloadPublicSamples -RunHoldout
[CmdletBinding()]
param(
    [switch]$DownloadPublicSamples,
    [switch]$RunHoldout
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$homeDir = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-VOICE-LAB'
$sampleDir = Join-Path $homeDir 'samples'
$py = Join-Path $homeDir '.venv\Scripts\python.exe'
$diarizer = Join-Path $PSScriptRoot 'offline_diarization.py'
$seg = Join-Path $homeDir 'models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx'
$oldEmb = Join-Path $homeDir 'models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx'
$newEmb = Join-Path $homeDir 'models\3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx'
$camSha = 'AA3CFC16963A10586A9393F5035D6D6B57E98D358B347F80C2A30BF4F00CEBA2'

function RequireFile([string]$file, [string]$label) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Missing ${label}: use only the isolated VOICE lab."
    }
}
function GetPublicWav([string]$filename, [long]$expectedBytes) {
    $url = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/' + $filename
    $dest = Join-Path $sampleDir $filename
    New-Item -ItemType Directory -Force -Path $sampleDir | Out-Null
    if (-not (Test-Path -LiteralPath $dest)) {
        $partial = $dest + '.partial-download'
        if (Test-Path -LiteralPath $partial) {
            throw 'An incomplete WAV download exists. Inspect it before retrying.'
        }
        try {
            Invoke-WebRequest -Uri $url -OutFile $partial -UseBasicParsing
            if ((Get-Item -LiteralPath $partial).Length -ne $expectedBytes) {
                throw "Official release asset size mismatch: $filename"
            }
            Move-Item -LiteralPath $partial -Destination $dest
        } catch {
            if (Test-Path -LiteralPath $partial) {
                Remove-Item -LiteralPath $partial -Force
            }
            throw
        }
    }
    if ((Get-Item -LiteralPath $dest).Length -ne $expectedBytes) {
        throw "Existing WAV has a size mismatch: $filename"
    }
    Write-Host 'Public WAV:' $filename
    Write-Host 'Local SHA256 (not independently compared):' (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
    return $dest
}

Write-Host '=== VOICE-01H / unseen public audio / no LUMIA runtime changes ==='
RequireFile $py 'VOICE Python'
RequireFile $diarizer 'offline_diarization.py'
RequireFile $seg 'segmentation model'
RequireFile $oldEmb 'ERes2Net embedding'
RequireFile $newEmb 'CAM++ embedding'

if ((Get-FileHash -LiteralPath $newEmb -Algorithm SHA256).Hash.ToUpperInvariant() -ne $camSha) {
    throw 'CAM++ model SHA256 differs from pinned upstream maintainer copy.'
}

if ($DownloadPublicSamples) {
    $null = GetPublicWav '2-two-speakers-en.wav' 1088078
    $null = GetPublicWav '3-two-speakers-en.wav' 1753804
}
if (-not $RunHoldout) {
    Write-Host 'No offline inference requested.'
    return
}

# The labels in filenames are upstream hints, NOT human RTTM truth.
$cases = @(
    @{ Name = '2-two-speakers-en'; File = '2-two-speakers-en.wav'; Bytes = 1088078; Expected = 2 },
    @{ Name = '3-two-speakers-en'; File = '3-two-speakers-en.wav'; Bytes = 1753804; Expected = 2 }
)
$models = @(
    @{ Name = 'ERes2Net'; Path = $oldEmb },
    @{ Name = 'CAM++'; Path = $newEmb }
)
$thresholds = @('0.50', '0.75')
$rows = @()

foreach ($test in $cases) {
    $wav = Join-Path $sampleDir $test.File
    RequireFile $wav $test.Name
    if ((Get-Item -LiteralPath $wav).Length -ne $test.Bytes) {
        throw 'Public test WAV size does not match upstream release.'
    }
    foreach ($threshold in $thresholds) {
        foreach ($model in $models) {
            Write-Host ("=== HOLDOUT {0}, {1}, threshold={2} ===" -f $test.Name, $model.Name, $threshold)
            $argsPython = @(
                '-B', $diarizer,
                '--wav', $wav,
                '--segmentation-model', $seg,
                '--embedding-model', $model.Path,
                '--num-speakers', '-1',
                '--cluster-threshold', $threshold,
                '--consent'
            )
            $output = & $py @argsPython
            if ($LASTEXITCODE -ne 0) {
                throw ("Holdout inference failed: {0}, {1}" -f $test.Name, $model.Name)
            }
            $r = $output | ConvertFrom-Json
            if (-not $r.ok -or $r.num_speakers_requested -ne -1 -or $r.duration_s -le 0) {
                throw 'Unexpected lab JSON or forced group count.'
            }
            $rows += [PSCustomObject]@{
                Model = $model.Name
                Sample = $test.Name
                Threshold = $threshold
                Expected = $test.Expected
                Detected = $r.speaker_count
                CountMatch = ($r.speaker_count -eq $test.Expected)
                Segments = $r.segment_count
                Milliseconds = $r.elapsed_ms
                RTF = [math]::Round(($r.elapsed_ms / 1000.0) / $r.duration_s, 3)
            }
            if ($model.Name -eq 'CAM++' -and $threshold -eq '0.50') {
                Write-Host ("=== CAM++ detailed segments: {0} ===" -f $test.Name)
                $r.segments | Format-Table -AutoSize
            }
        }
    }
}
Write-Host '=== RESULTADOS VOICE-01H HOLDOUT ==='
$rows | Format-Table -AutoSize
Write-Host 'CountMatch is based on filename count only, NOT correct diarization per turn.'
Write-Host 'No microphone, personal audio, DER, identity, live audio or model activation in LUMIA.'
