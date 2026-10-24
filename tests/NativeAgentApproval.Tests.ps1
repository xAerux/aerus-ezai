$ErrorActionPreference = 'Stop'
$desktop = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'EZ AI.exe' } | Select-Object -First 1
if (!$desktop) { throw 'Open the packaged EZ AI.exe before running this native API test.' }
$service = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'EZ AI Service.exe' -and $_.ParentProcessId -eq $desktop.ProcessId } | Select-Object -First 1
if (!$service) { throw 'The packaged EZ AI service was not found under the desktop process.' }
$listener = Get-NetTCPConnection -State Listen -OwningProcess $service.ProcessId -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq '127.0.0.1' } | Select-Object -First 1
if (!$listener -or $listener.LocalPort -lt 1024) { throw 'Could not resolve the packaged service OS-assigned loopback port.' }
$port = [string]$listener.LocalPort
$baseUrl = "http://127.0.0.1:$port"
& (Join-Path $PSScriptRoot 'HardwareScanApi.Tests.ps1') -BaseUrl $baseUrl
if (!$?) { throw 'Hardware scanner API regression failed.' }

$launchUrl = "$baseUrl/api/agents/launch"
$payload = @{ agentId='codex'; modelId='qwen3-coder:30b-a3b-q4_K_M'; workspace=(Get-Location).Path; profile='manual'; approved=$false } | ConvertTo-Json -Compress
function Assert-LaunchRequestRejected($request, [int]$expectedStatus, [string]$label) {
    $rejected = $false
    try {
        Invoke-WebRequest -Uri $launchUrl -Method Post -Headers @{ Origin=$baseUrl } -ContentType 'application/json' -Body ($request | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 | Out-Null
    } catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq $expectedStatus) { $rejected = $true }
    }
    if (!$rejected) { throw "Launch policy regression: $label was not rejected with HTTP $expectedStatus." }
    Write-Host "PASS: $label is rejected; no coding agent was started."
}
$request = ConvertFrom-Json $payload
Assert-LaunchRequestRejected $request 409 'request without direct approval'
$request.approved=$true; $request.agentId='unrecognized-agent'
Assert-LaunchRequestRejected $request 400 'unrecognized agent ID'
$request.agentId='codex'; $request.profile='yolo'
Assert-LaunchRequestRejected $request 400 'unrestricted YOLO profile'
$request.profile='manual'; $request.modelId='qwen;start-process'
Assert-LaunchRequestRejected $request 409 'shell-shaped model identifier'
