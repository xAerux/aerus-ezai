$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$version = '1.0.0-beta.3'
$candidate = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-m09a-package-' + [Guid]::NewGuid().ToString('N'))
$service = $null
try {
    New-Item -ItemType Directory -Path (Join-Path $candidate 'dist\dist') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $candidate 'dist\stale-sentinel.js') -Value 'must not ship'
    Set-Content -LiteralPath (Join-Path $candidate 'dist\dist\nested-sentinel.js') -Value 'must not ship'
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tools\Build-EzAiDesktop.ps1') -ProjectRoot $root -OutputDirectory $candidate -Version $version
    if ($LASTEXITCODE -ne 0) { throw 'Candidate package build failed.' }
    if ((Test-Path (Join-Path $candidate 'dist\stale-sentinel.js')) -or (Test-Path (Join-Path $candidate 'dist\dist'))) { throw 'Candidate package retained stale or nested UI assets.' }
    $candidateIndex = Get-Content (Join-Path $candidate 'dist\index.html') -Raw
    if ($candidateIndex -notmatch 'assets/index-[^"'']+\.js') { throw 'Candidate UI index does not reference the production asset bundle.' }
    $manifest = Get-Content (Join-Path $candidate "EZ-AI-v$version-build-manifest.json") -Raw | ConvertFrom-Json
    if ($manifest.packageType -notmatch 'not an installer' -or $manifest.signatureStatus -notmatch 'Unsigned') { throw 'Release manifest overstates package or signature status.' }
    if ($manifest.files.path | Where-Object { [IO.Path]::IsPathRooted($_) }) { throw 'Release manifest contains an absolute local path.' }
    if (-not (Test-Path (Join-Path $candidate "EZ-AI-v$version-SHA256SUMS.txt"))) { throw 'Release SHA-256 manifest is missing.' }
    if (-not (Test-Path (Join-Path $candidate 'WEBVIEW2-LICENSE.txt')) -or -not (Test-Path (Join-Path $candidate 'WEBVIEW2-NOTICE.txt'))) { throw 'WebView2 license and third-party notice must accompany redistributed SDK binaries.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tests\DesktopLauncherIntegrity.Tests.ps1') -ProjectRoot $root -ReleaseDirectory $candidate -SkipShortcutCheck
    if ($LASTEXITCODE -ne 0) { throw 'Desktop launcher integrity checks failed.' }
    $servicePath = Join-Path $candidate 'EZ AI Service.exe'
    $service = Start-Process -FilePath $servicePath -ArgumentList '--port=62365 --no-browser' -PassThru -WindowStyle Hidden
    $ready = $false
    for ($i=0; $i -lt 50; $i++) {
        try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:62365/' -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) {$ready=$true;break} } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw 'Candidate service did not become ready.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tests\ApplicationActionsApi.Tests.ps1') -BaseUrl 'http://127.0.0.1:62365'
    if ($LASTEXITCODE -ne 0) { throw 'Application action API tests failed.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tests\InstallerQueueApi.Tests.ps1') -BaseUrl 'http://127.0.0.1:62365'
    if ($LASTEXITCODE -ne 0) { throw 'Installer queue API tests failed.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tests\SoftwareDiscoveryApi.Tests.ps1') -BaseUrl 'http://127.0.0.1:62365'
    if ($LASTEXITCODE -ne 0) { throw 'Software discovery regression tests failed.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tests\HardwareScanApi.Tests.ps1') -BaseUrl 'http://127.0.0.1:62365'
    if ($LASTEXITCODE -ne 0) { throw 'Hardware scan regression tests failed.' }
    Write-Host "Candidate native host ($version): $candidate\EZ AI.exe"
    Write-Host 'Candidate service API and discovery regression checks passed; no application installer or installed app was launched.'
} finally {
    if ($service -and -not $service.HasExited) { Stop-Process -Id $service.Id -Force; $service.WaitForExit() }
    $safeRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolved = [IO.Path]::GetFullPath($candidate)
    if (-not $resolved.StartsWith($safeRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing unsafe candidate-package cleanup.' }
    if ([IO.Directory]::Exists($resolved)) { [IO.Directory]::Delete($resolved,$true) }
}
