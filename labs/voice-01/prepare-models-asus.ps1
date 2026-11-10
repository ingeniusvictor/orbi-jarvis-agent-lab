# LUMIA VOICE-01: isolated ASUS bootstrap + official offline sherpa models.
# Invoke explicitly; no microphone, no voice-runtime or main branch changes.
[CmdletBinding()]
param(
    [switch]$Bootstrap,
    [switch]$DownloadModels,
    [switch]$DownloadSample,
    [switch]$RunDemo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$homeDir = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-VOICE-LAB'
$python = Join-Path $homeDir '.venv\Scripts\python.exe'
$modelDir = Join-Path $homeDir 'models'
$sampleDir = Join-Path $homeDir 'samples'
$segName = 'sherpa-onnx-pyannote-segmentation-3-0'
$segTar = Join-Path $modelDir ($segName + '.tar.bz2')
$segModel = Join-Path (Join-Path $modelDir $segName) 'model.onnx'
$embedName = '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx'
$embedModel = Join-Path $modelDir $embedName
$sampleFile = Join-Path $sampleDir '1-two-speakers-en.wav'

function RequireSuccess([string]$label) {
    if ($LASTEXITCODE -ne 0) { throw "$label failed with exit code $LASTEXITCODE" }
}

function GetOfficialAsset([string]$url, [string]$target, [long]$expectedBytes) {
    if ($url -notmatch '^https://github\.com/k2-fsa/sherpa-onnx/releases/download/') {
        throw 'Unexpected download host.'
    }
    $parent = Split-Path -Parent $target
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
    if (-not (Test-Path -LiteralPath $target)) {
        $part = $target + '.partial-download'
        if (Test-Path -LiteralPath $part) {
            throw 'Previous partial download exists. Inspect before retrying.'
        }
        try {
            Invoke-WebRequest -Uri $url -OutFile $part -UseBasicParsing -MaximumRedirection 10
            if ((Get-Item -LiteralPath $part).Length -ne $expectedBytes) {
                throw 'Asset differs from published release size. Refusing it.'
            }
            Move-Item -LiteralPath $part -Destination $target
        } catch {
            if (Test-Path -LiteralPath $part) {
                Remove-Item -LiteralPath $part -Force
            }
            throw
        }
    }
    if ((Get-Item -LiteralPath $target).Length -ne $expectedBytes) {
        throw 'Existing asset differs from published release size. Not overwriting.'
    }
    Write-Host 'File:' (Split-Path -Leaf $target)
    Write-Host 'Local SHA256:' (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    # Older speaker-model releases do not publish an API digest. The SHA above
    # is local auditing, not proof of equality to a published trusted hash.
}

function ExtractSegmentation {
    if (Test-Path -LiteralPath $segModel) {
        if ((Get-Item -LiteralPath $segModel).Length -lt 1000000) {
            throw 'Segmentation model unexpectedly small.'
        }
        return
    }
    $entries = @(& tar.exe -tf $segTar)
    RequireSuccess 'archive listing'
    if ($entries.Count -eq 0) { throw 'Empty archive.' }
    foreach ($entry in $entries) {
        $clean = $entry.Replace('\', '/')
        if ($clean.StartsWith('./')) { $clean = $clean.Substring(2) }
        if ($clean.StartsWith('/') -or $clean -match '(^|/)\.\.(/|$)' -or
            -not ($clean -eq $segName -or $clean.StartsWith($segName + '/'))) {
            throw 'Unexpected or unsafe archive entry.'
        }
    }
    $tempDir = Join-Path $modelDir ('extract-' + [guid]::NewGuid().ToString('N'))
    New-Item -Path $tempDir -ItemType Directory | Out-Null
    try {
        & tar.exe -xjf $segTar -C $tempDir
        RequireSuccess 'archive extraction'
        $unpacked = Join-Path $tempDir $segName
        $candidate = Join-Path $unpacked 'model.onnx'
        if (-not (Test-Path -LiteralPath $candidate) -or (Get-Item -LiteralPath $candidate).Length -lt 1000000) {
            throw 'model.onnx was not found in the extracted archive.'
        }
        if (Test-Path -LiteralPath (Join-Path $modelDir $segName)) {
            throw 'Destination already exists. Do not overwrite.'
        }
        Move-Item -LiteralPath $unpacked -Destination $modelDir
    } finally {
        if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
    }
}

Write-Host '=== LUMIA VOICE-01 / isolated OFFLINE CPU ==='
Write-Host 'Private lab root:' $homeDir
if ($Bootstrap) {
    $facePython = Join-Path $env:LOCALAPPDATA 'ORBI\LUMIA-FACE-LAB-VI04B\.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $facePython)) {
        throw 'Python of FACE-LAB not found. No global Python installation will be attempted.'
    }
    if (-not (Test-Path -LiteralPath $python)) {
        $baseExecutable = (& $facePython -c 'import sys; print(sys._base_executable)').Trim()
        RequireSuccess 'find base Python'
        if (-not (Test-Path -LiteralPath $baseExecutable)) { throw 'Missing base Python executable.' }
        New-Item -Path $homeDir -ItemType Directory -Force | Out-Null
        & $baseExecutable -m venv (Join-Path $homeDir '.venv')
        RequireSuccess 'create private voice venv'
    }
    & $python -m pip install --only-binary=:all: -r (Join-Path $PSScriptRoot 'requirements-optional.txt')
    RequireSuccess 'install sherpa only in private voice venv'
}
if (-not (Test-Path -LiteralPath $python)) {
    throw 'VOICE-01 Python is missing: run with -Bootstrap.'
}
& $python -c 'import sherpa_onnx; import numpy; print("SHERPA ONNX IMPORT OK")'
RequireSuccess 'verify sherpa'
& $python -B (Join-Path $PSScriptRoot 'offline_diarization.py') --doctor
RequireSuccess 'offline doctor'

if ($DownloadModels) {
    GetOfficialAsset 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2' $segTar 6958444
    ExtractSegmentation
    GetOfficialAsset 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx' $embedModel 39593761
}
if ($DownloadSample) {
    GetOfficialAsset 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/1-two-speakers-en.wav' $sampleFile 512044
}

Write-Host 'Segmentation model ready:' (Test-Path -LiteralPath $segModel)
Write-Host 'Speaker embeddings ready:' (Test-Path -LiteralPath $embedModel)
Write-Host 'Official public sample ready:' (Test-Path -LiteralPath $sampleFile)

if ($RunDemo) {
    foreach ($needed in @($segModel, $embedModel, $sampleFile)) {
        if (-not (Test-Path -LiteralPath $needed)) {
            throw 'Required model or test WAV missing. Run with -DownloadModels -DownloadSample.'
        }
    }
    & $python -B (Join-Path $PSScriptRoot 'offline_diarization.py') --wav $sampleFile --segmentation-model $segModel --embedding-model $embedModel --num-speakers 2 --consent
    RequireSuccess 'two-speaker public WAV demo'
}
Write-Host 'VOICE-01: no microphone opened and no LUMIA runtime changed.'
