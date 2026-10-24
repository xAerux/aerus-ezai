param(
    [string]$BaseUrl = 'http://127.0.0.1:62363'
)

$ErrorActionPreference = 'Stop'
$origin = ([Uri]$BaseUrl).GetLeftPart([UriPartial]::Authority)
$scanUri = $BaseUrl.TrimEnd('/') + '/api/discovery/scan'
function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

$body = @{ customModelFoldersB64 = @() } | ConvertTo-Json -Compress
$scan = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -ContentType 'application/json' -Body $body -TimeoutSec 60
Assert-True ($scan.schemaVersion -eq 1 -and $scan.status -in @('success', 'partial')) 'returns a versioned, real discovery result'
Assert-True ($scan.applications.Count -ge 8 -and $scan.codingAgents.Count -ge 5 -and $scan.runtimes.Count -ge 3) 'covers desktop apps, separate coding agents, and local runtimes'
Assert-True ($scan.models -is [System.Array] -and $scan.sources.Count -gt 0 -and $scan.durationMs -ge 0) 'includes local model metadata, sources, and measured scan time'
$enhancements = @($scan.enhancements)
Assert-True ($enhancements.Count -eq 3 -and ($enhancements.id -contains 'context7') -and ($enhancements.id -contains 'claude-mem') -and ($enhancements.id -contains 'comfyui-manager')) 'reports only the three documented enhancement marker checks'
Assert-True (($enhancements.status | Where-Object { $_ -notin @('Installed', 'Needs Verification', 'Not Detected', 'Scan Incomplete') }).Count -eq 0 -and ($enhancements.configured -contains 'Not checked') -and ($enhancements.enabled -contains 'Not checked') -and ($enhancements.running -contains 'Not checked')) 'keeps marker presence separate from configured, enabled, and running states'
Assert-True ((($enhancements.evidence -join ' ') -notmatch '[A-Z]:\\Users\\') -and (($enhancements | ConvertTo-Json -Depth 5) -notmatch '[A-Z]:\\Users\\')) 'does not expose inspected user paths in enhancement evidence'
Assert-True (($scan.codingAgents.name -contains 'Codex Desktop') -and ($scan.codingAgents.name -contains 'Codex CLI')) 'keeps Codex Desktop and Codex CLI as separate findings'
Assert-True (($scan.models.id | Select-Object -Unique).Count -eq $scan.models.Count) 'does not count duplicate model identities as separate model records'
Assert-True (($scan.applications.id | Select-Object -Unique).Count -eq $scan.applications.Count -and ($scan.codingAgents.id | Select-Object -Unique).Count -eq $scan.codingAgents.Count) 'keeps one inventory row per supported application identity'
$openAiCodexPackage = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $openAiCodexPackage) {
    $codexDesktop = $scan.codingAgents | Where-Object { $_.name -eq 'Codex Desktop' } | Select-Object -First 1
    Assert-True ($codexDesktop.status -eq 'Installed' -and $codexDesktop.version -eq [string]$openAiCodexPackage.Version -and $codexDesktop.installationType -match 'bundled in ChatGPT' -and ($codexDesktop.evidence -join ' ') -match 'CodexCoreCommandRunner') 'verifies Codex as a bundled capability in the OpenAI.Codex ChatGPT package, not an independent desktop package'
    $chatGptDesktop = $scan.applications | Where-Object { $_.name -eq 'ChatGPT' } | Select-Object -First 1
    Assert-True ($chatGptDesktop.status -in @('Running','Installed') -and $chatGptDesktop.version -eq [string]$openAiCodexPackage.Version -and ($chatGptDesktop.evidence -join ' ') -match 'ChatGPT.exe') 'verifies ChatGPT.exe as the app identity in the unified OpenAI.Codex package'
}
$claudePackage = Get-AppxPackage -Name 'Claude' -ErrorAction SilentlyContinue | Select-Object -First 1
$claudeDesktop = $scan.applications | Where-Object { $_.name -eq 'Claude Desktop' } | Select-Object -First 1
if ($null -ne $claudePackage) {
    Assert-True ($null -ne $claudeDesktop -and $claudeDesktop.status -in @('Installed', 'Running') -and $claudeDesktop.version -eq [string]$claudePackage.Version -and ($claudeDesktop.evidence -join ' ') -match 'package Claude') 'recognizes Claude Desktop from its independent Claude AppX package and installed version'
}
$comfyDesktop = $scan.applications | Where-Object { $_.id -eq 'app-comfyui-desktop' } | Select-Object -First 1
$comfyBackendApp = $scan.applications | Where-Object { $_.id -eq 'app-comfyui' } | Select-Object -First 1
$comfyRuntime = $scan.runtimes | Where-Object { $_.id -eq 'comfyui-local' } | Select-Object -First 1
$comfyModels = @($scan.models | Where-Object { $_.runtime -eq 'ComfyUI' })
$comfyHealth = $null
try { $comfyHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8188/system_stats' -Method Get -TimeoutSec 3 } catch { }
Assert-True ($null -ne $comfyDesktop -and $comfyDesktop.status -in @('Installed', 'Running') -and ($comfyDesktop.evidence -join ' ') -match 'Comfy Desktop') 'recognizes ComfyUI Desktop through its distinct verified application identity'
Assert-True ($null -ne $comfyBackendApp -and ($comfyDesktop.status -ne 'Running' -or ($comfyDesktop.evidence -join ' ') -match 'Active process confirmed')) 'a healthy ComfyUI local API cannot mark the distinct Desktop application as Running'
$comfyRuntimeEvidence = if ($null -ne $comfyRuntime) { $comfyRuntime.evidence -join ' ' } else { '' }
$comfyInstallationVerified = $comfyRuntimeEvidence -match 'Verified Comfy Desktop managed runtime'
$comfyEndpointEvidence = $comfyRuntimeEvidence -match '8188'
$comfyHealthReportedSeparately = ($null -ne $comfyRuntime -and $comfyRuntime.operationalStatus -match 'local endpoint')
Assert-True ($null -ne $comfyRuntime -and $comfyRuntime.status -in @('Installed', 'Running', 'Data Found Only') -and ($comfyEndpointEvidence -or ($comfyInstallationVerified -and $comfyHealthReportedSeparately))) 'reports ComfyUI installation/runtime separately from its local endpoint health'
if ($null -ne $comfyHealth -and $null -ne $comfyHealth.system.comfyui_version) {
    Assert-True ($comfyRuntime.status -eq 'Running' -and $comfyRuntime.version -eq [string]$comfyHealth.system.comfyui_version) 'uses the verified ComfyUI API version for the runtime, not the separate Desktop application version'
}
Assert-True ($comfyModels.Count -gt 0 -and ($comfyModels.location -join ' ') -match 'ComfyUI-Shared') 'discovers actual models in Comfy Desktop shared model storage'

$blocked = $false
try {
    Invoke-WebRequest -Uri $scanUri -Method Post -Headers @{ Origin = 'https://attacker.invalid'; Accept = 'application/json' } -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $blocked = ($status -eq 403)
}
Assert-True $blocked 'rejects a cross-origin discovery request'

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-discovery-fixture-' + [Guid]::NewGuid().ToString('N'))
try {
    [IO.Directory]::CreateDirectory($fixtureRoot) | Out-Null
    $fixtureFile = Join-Path $fixtureRoot 'mission04-test-Q4_K_M.gguf'
    [IO.File]::WriteAllBytes($fixtureFile, [byte[]](1, 2, 3, 4, 5, 6, 7))
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'opencode.cmd'), '@echo off')
    $comfyCategory = Join-Path $fixtureRoot 'external-assets\custom-checkpoints'
    [IO.Directory]::CreateDirectory($comfyCategory) | Out-Null
    $comfyModel = Join-Path $comfyCategory 'mission04-checkpoint-Q4_K_M.safetensors'
    [IO.File]::WriteAllBytes($comfyModel, [byte[]](1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13))
    $yaml = "comfyui:`n  base_path: `"$fixtureRoot`"`n  checkpoints: external-assets/custom-checkpoints`n"
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'extra_model_paths.yaml'), $yaml)
    $brokenShortcut = Join-Path $fixtureRoot 'Gemini.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($brokenShortcut)
    $shortcut.TargetPath = Join-Path $fixtureRoot 'missing-gemini.exe'
    $shortcut.Save()
    $encodedPath = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fixtureRoot))
    $customBody = @{ customModelFoldersB64 = @($encodedPath) } | ConvertTo-Json -Compress
    $custom = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -ContentType 'application/json' -Body $customBody -TimeoutSec 60
    $fixture = $custom.models | Where-Object { $_.runtime -eq 'Custom folder' -and $_.name -eq 'mission04-test-Q4_K_M' } | Select-Object -First 1
    Assert-True ($null -ne $fixture -and $fixture.sizeBytes -eq 7 -and $fixture.quantization -eq 'Q4_K_M') 'reads only the explicitly approved custom folder and recognizes model file metadata'
    $comfyFinding = $custom.models | Where-Object { $_.runtime -eq 'ComfyUI' -and $_.name -eq 'mission04-checkpoint-Q4_K_M' } | Select-Object -First 1
    Assert-True ($null -ne $comfyFinding -and $comfyFinding.sizeBytes -eq 13 -and $comfyFinding.categories -contains 'Creative & Multimodal') 'reads a ComfyUI extra_model_paths.yaml category without opening model contents'
    $brokenFinding = $custom.applications | Where-Object { $_.name -eq 'Gemini' } | Select-Object -First 1
    Assert-True ($null -ne $brokenFinding -and $brokenFinding.status -eq 'Needs Verification' -and ($brokenFinding.evidence -join ' ') -match 'target missing or not resolved') 'classifies a broken user-approved application shortcut as Needs Verification'
    $customApp = $custom.codingAgents | Where-Object { $_.name -eq 'OpenCode' } | Select-Object -First 1
    Assert-True ($null -ne $customApp -and ($customApp.evidence -join ' ') -match 'Recognized executable or CLI shim exists in the user-approved folder') 'checks approved custom folders and includes recognized application evidence'
    $missingFolder = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-missing-' + [Guid]::NewGuid().ToString('N'))
    $missingBody = @{ customModelFoldersB64 = @([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($missingFolder))) } | ConvertTo-Json -Compress
    $partial = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -ContentType 'application/json' -Body $missingBody -TimeoutSec 60
    Assert-True ($partial.status -eq 'partial' -and $partial.warnings.Count -gt 0) 'reports an unavailable approved model directory as a partial scan'
} finally {
    if ([IO.Directory]::Exists($fixtureRoot)) {
        $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
        if (-not $resolvedFixture.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove the test fixture outside the temporary directory.' }
        [IO.Directory]::Delete($resolvedFixture, $true)
    }
}

$retry = Invoke-RestMethod -Uri $scanUri -Method Post -Headers @{ Origin = $origin; Accept = 'application/json' } -ContentType 'application/json' -Body $body -TimeoutSec 60
Assert-True ($retry.status -in @('success', 'partial')) 'a rejected request and custom-folder scan do not block later valid scans'
Write-Host "Software discovery API checks passed. Status: $($retry.status); duration: $($retry.durationMs) ms; model records: $($retry.models.Count); enhancement markers: $($retry.enhancements.Count)"
