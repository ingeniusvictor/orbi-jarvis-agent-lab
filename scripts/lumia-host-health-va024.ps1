# VA-02.4: Observacion de CPU y energia, sin sintesis, grabacion ni escrituras.
# Ejecutar exclusivamente desde LUMIA-VQ03-QA; nunca desde LUMIA-ASUS.
# Los contadores Windows CIM pueden no estar disponibles; ND es un resultado valido.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail-VA024([string]$reason) {
    throw "VA024_$reason"
}
$qa = Join-Path $env:USERPROFILE 'LUMIA-VQ03-QA'
$original = Join-Path $env:USERPROFILE 'LUMIA-ASUS'
$baseSha = '1580a5182eba540893e35e37065be77da4ed014c'
$branchName = 'feature/lumia-vq03-vrm-intent-clarity-20261113'
if (!(Test-Path -LiteralPath $qa -PathType Container) -or !(Test-Path -LiteralPath $original -PathType Container)) {
    Fail-VA024 'FOLDERS_MISSING'
}
$actualRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$expectedRoot = (Resolve-Path -LiteralPath $qa).Path
if ($actualRoot -ine $expectedRoot) {
    Fail-VA024 'ONLY_QA_CLONE_ALLOWED'
}
$rev = (& git -C $original rev-parse HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or "$rev".Trim() -ne $baseSha) {
    Fail-VA024 'BASELINE_CHANGED'
}
$branch = (& git -C $qa branch --show-current 2>$null)
if ($LASTEXITCODE -ne 0 -or "$branch".Trim() -ne $branchName) {
    Fail-VA024 'WRONG_QA_BRANCH'
}

Write-Output '[VA-02.4] Diagnostico breve en reposo: no inicia Kokoro ni cambia configuraciones.'

try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $line = [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus
    Write-Output "[VA-02.4] Alimentacion: $line"
} catch {
    Write-Output '[VA-02.4] Alimentacion: ND'
}
try {
    $scheme = (& powercfg /getactivescheme 2>$null | Out-String)
    if ($LASTEXITCODE -eq 0 -and $scheme -match '\(([^()]*)\)') {
        Write-Output "[VA-02.4] Plan de energia: $($Matches[1])"
    } else {
        Write-Output '[VA-02.4] Plan de energia: ND'
    }
} catch {
    Write-Output '[VA-02.4] Plan de energia: ND'
}
try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $freeGB = [Math]::Round(([double]$os.FreePhysicalMemory / 1048576), 2)
    Write-Output "[VA-02.4] RAM libre: $freeGB GB"
} catch {
    Write-Output '[VA-02.4] RAM libre: ND'
}

$loads = @()
$freqs = @()
$limits = @()
for ($i = 1; $i -le 8; $i++) {
    $perf = $null
    $cpu = $null
    try {
        $perf = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ProcessorInformation -Filter "Name='_Total'" -ErrorAction Stop | Select-Object -First 1
    } catch { $perf = $null }
    try {
        $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1
    } catch { $cpu = $null }

    $load = $null
    $frequency = $null
    $limit = $null
    if ($perf -and $perf.PSObject.Properties.Name -contains 'PercentProcessorTime') {
        $load = [double]$perf.PercentProcessorTime
    } elseif ($cpu) {
        $load = [double]$cpu.LoadPercentage
    }
    if ($perf -and $perf.PSObject.Properties.Name -contains 'PercentofMaximumFrequency') {
        $frequency = [double]$perf.PercentofMaximumFrequency
    }
    if ($perf -and $perf.PSObject.Properties.Name -contains 'PercentPerformanceLimit') {
        $limit = [double]$perf.PercentPerformanceLimit
    }

    $loadText = if ($null -ne $load) { "$([Math]::Round($load,1))%" } else { 'ND' }
    $freqText = if ($null -ne $frequency) { "$([Math]::Round($frequency,1))%" } else { 'ND' }
    $limitText = if ($null -ne $limit) { "$([Math]::Round($limit,1))%" } else { 'ND' }
    Write-Output "[VA-02.4] muestra $i CPU: $loadText | frecuencia relativa: $freqText | limite: $limitText"

    if ($null -ne $load) { $loads += $load }
    if ($null -ne $frequency) { $freqs += $frequency }
    if ($null -ne $limit) { $limits += $limit }
    if ($i -lt 8) { Start-Sleep -Seconds 1 }
}
if ($loads.Count -gt 0) {
    $average = [Math]::Round(($loads | Measure-Object -Average).Average,1)
    Write-Output "[VA-02.4] CPU promedio en reposo: $average%"
}
if ($freqs.Count -gt 0) {
    $lowest = [Math]::Round(($freqs | Measure-Object -Minimum).Minimum,1)
    Write-Output "[VA-02.4] Frecuencia relativa minima: $lowest%"
}
if ($limits.Count -gt 0) {
    $limitLow = [Math]::Round(($limits | Measure-Object -Minimum).Minimum,1)
    Write-Output "[VA-02.4] Limite minimo de rendimiento informado: $limitLow%"
}
Write-Output '[VA-02.4] ND significa contador no disponible. Frecuencia relativa no es MHz reales.'
Write-Output '[VA-02.4] Windows CIM NO certifica temperatura CPU ni throttling termico.'
Write-Output '[VA-02.4] Finalizado: no se guardaron archivos ni se cambiaron servicios o energia.'
