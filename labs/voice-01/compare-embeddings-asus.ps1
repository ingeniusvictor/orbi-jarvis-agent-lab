# LUMIA VOICE-01G: isolated speaker embeddings A/B on PUBLIC WAVs only.
# No microphone, no filesystem writing of outputs, no updates to live LUMIA.
# Usage: .\labs\voice-01\compare-embeddings-asus.ps1 -DownloadCandidate -RunPublicComparison
[CmdletBinding()]
param([switch]$DownloadCandidate, [switch]$RunPublicComparison)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$homeDir = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-VOICE-LAB'
$python = Join-Path $homeDir '.venv\Scripts\python.exe'
$diarizer = Join-Path $PSScriptRoot 'offline_diarization.py'
$segmenter = Join-Path $homeDir 'models\sherpa-onnx-pyannote-segmentation-3-0\model.onnx'
$existingEmbedding = Join-Path $homeDir 'models\3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx'
$candidate = Join-Path $homeDir 'models\3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx'
$two = Join-Path $homeDir 'samples\1-two-speakers-en.wav'
$four = Join-Path $homeDir 'samples\0-four-speakers-zh.wav'

# Asset length checked via upstream GitHub release metadata (28,281,164 bytes).
# SHA256 copied from an independent mirror; official release API has no digest.
$expectedSize = 28281164
$expectedSha = 'AA3CFC16963A10586A9393F5035D6D6B57E98D358B347F80C2A30BF4F00CEBA2'
$source = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx'

function RequireFile([string]$path, [string]$label) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing $label. Keep this test isolated from the main LUMIA installation."
    }
}
function CheckCandidate {
    RequireFile $candidate 'CAM++ embedding ONNX'
    if ((Get-Item -LiteralPath $candidate).Length -ne $expectedSize) {
        throw 'CAM++ size differs from the pinned upstream release.'
    }
    $sha = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
    if ($sha.ToUpperInvariant() -ne $expectedSha) {
        throw 'CAM++ digest differs from the independent pinned model mirror.'
    }
    Write-Host 'CAM++ model size and pinned SHA256 match.'
}

Write-Host '=== VOICE-01G: CPU offline embedding comparison ==='
RequireFile $python 'VOICE-01 isolated Python'
RequireFile $diarizer 'offline_diarization.py'
RequireFile $segmenter 'Pyannote segmentation ONNX'
RequireFile $existingEmbedding 'ERes2Net original embedding ONNX'
RequireFile $two 'public two-speaker WAV'
RequireFile $four 'public four-speaker WAV'

if ($DownloadCandidate) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $candidate) | Out-Null
    if (-not (Test-Path -LiteralPath $candidate)) {
        $partial = $candidate + '.partial-download'
        if (Test-Path -LiteralPath $partial) {
            throw 'Partial download already exists: inspect it before retry.'
        }
        try {
            Invoke-WebRequest -Uri $source -OutFile $partial -UseBasicParsing
            if ((Get-Item -LiteralPath $partial).Length -ne $expectedSize) {
                throw 'Downloaded CAM++ model has unexpected file length.'
            }
            $sha = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
            if ($sha.ToUpperInvariant() -ne $expectedSha) {
                throw 'Downloaded CAM++ model differs from pinned checksum.'
            }
            Move-Item -LiteralPath $partial -Destination $candidate
        } catch {
            if (Test-Path -LiteralPath $partial) {
                Remove-Item -LiteralPath $partial -Force
            }
            throw
        }
    }
    CheckCandidate
}

if (-not $RunPublicComparison) {
    Write-Host 'No inference requested; only optional model preparation/check.'
    return
}
CheckCandidate

$tests = @(
    @{ Sample = '2-speaker EN'; Wave = $two; Expected = 2 },
    @{ Sample = '4-speaker ZH'; Wave = $four; Expected = 4 }
)
$thresholds = @('0.50', '0.75', '0.85')
$rows = @()

foreach ($test in $tests) {
    foreach ($threshold in $thresholds) {
        Write-Host ("=== CAM++ {0} threshold={1} ===" -f $test.Sample, $threshold)
        $pythonArgs = @(
            '-B', $diarizer,
            '--wav', $test.Wave,
            '--segmentation-model', $segmenter,
            '--embedding-model', $candidate,
            '--num-speakers', '-1',
            '--cluster-threshold', $threshold,
            '--consent'
        )
        $output = & $python @pythonArgs
        if ($LASTEXITCODE -ne 0) {
            throw 'CAM++ inference failed. Do not treat partial results as successful.'
        }
        $r = $output | ConvertFrom-Json
        if (-not $r.ok -or $r.num_speakers_requested -ne -1) {
            throw 'Unexpected JSON or non-automatic clustering.'
        }
        $rows += [PSCustomObject]@{
            Model = 'CAM++'
            Sample = $test.Sample
            Expected = $test.Expected
            Threshold = $threshold
            Detected = $r.speaker_count
            Segments = $r.segment_count
            Milliseconds = $r.elapsed_ms
        }
        if ($test.Expected -eq 4 -and $threshold -eq '0.50') {
            Write-Host '=== CAM++ 4-speaker segment assignments, 0.50 ==='
            $r.segments | Format-Table -AutoSize
        }
    }
}
Write-Host '=== RESULTADOS VOICE-01G CAM++ ==='
$rows | Format-Table -AutoSize
Write-Host 'ERes2Net baseline 2-speaker: 2 at 0.50/0.75, 1 at 0.85.'
Write-Host 'ERes2Net baseline 4-speaker: 7 at 0.50, 5 at 0.75/0.85.'
Write-Host 'No microphone, identity verification, LUMIA live-runtime changes or saved transcripts.'
