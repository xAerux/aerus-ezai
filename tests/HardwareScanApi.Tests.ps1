param(
    [string]$BaseUrl = 'http://127.0.0.1:62363'
)

$ErrorActionPreference = 'Stop'
$origin = ([Uri]$BaseUrl).GetLeftPart([UriPartial]::Authority)
$scanUri = $BaseUrl.TrimEnd('/') + '/api/hardware/scan'

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

$scan = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -TimeoutSec 120
Assert-True ($scan.schemaVersion -eq 1) 'returns the versioned hardware contract'
Assert-True ($scan.status -in @('success', 'partial')) 'reports a real success or partial scan result'
Assert-True ($null -ne $scan.scannedAtUtc -and $null -ne $scan.cpu -and $null -ne $scan.windows) 'includes scan time, CPU, and Windows records'
Assert-True ($scan.gpus -is [System.Array] -and $scan.drives -is [System.Array]) 'includes GPU and fixed-drive collections'
Assert-True ($null -ne $scan.memory.installedBytes) 'includes the installed-memory measurement'

$blocked = $false
try {
    Invoke-WebRequest -Uri $scanUri -Method Post -Headers @{ Origin = 'https://attacker.invalid'; Accept = 'application/json' } -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $blocked = ($status -eq 403)
}
Assert-True $blocked 'rejects a cross-origin hardware scan request'

$retry = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -TimeoutSec 120
Assert-True ($retry.status -in @('success', 'partial')) 'a rejected request does not prevent a later valid retry'
Write-Host "Hardware API integration checks passed. Status: $($retry.status); scanned: $($retry.scannedAtUtc)"
