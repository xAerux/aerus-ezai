$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exe = Join-Path $root 'release\EZ AI.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build release\EZ AI.exe before running this native smoke test.' }
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EZ AI.lnk'
if (-not (Test-Path -LiteralPath $desktopShortcut)) { throw 'The EZ AI Desktop shortcut for this user was not found.' }
$shell = New-Object -ComObject WScript.Shell
$shortcutInfo = $shell.CreateShortcut($desktopShortcut)
if (-not [String]::Equals([IO.Path]::GetFullPath($shortcutInfo.TargetPath), [IO.Path]::GetFullPath($exe), [StringComparison]::OrdinalIgnoreCase)) { throw 'The EZ AI Desktop shortcut does not target this release executable.' }
$hostProcess = $null
$browserNames = @('msedge','chrome','firefox','brave','opera','vivaldi','iexplore')
$baselineBrowsers = @{}
foreach ($name in $browserNames) { $baselineBrowsers[$name] = @(Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object Id) }
$serviceIdsBefore = @(Get-Process -Name 'EZ AI Service' -ErrorAction SilentlyContinue | ForEach-Object Id)
try {
    $hostProcess = Start-Process -FilePath $desktopShortcut -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    $windowFound = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        $hostProcess.Refresh()
        if ($hostProcess.HasExited) { throw "Native host exited during startup (code $($hostProcess.ExitCode))." }
        if ($hostProcess.MainWindowHandle -ne [IntPtr]::Zero -and $hostProcess.MainWindowTitle -eq 'EZ AI') { $windowFound = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $windowFound) { throw 'The native WPF window did not appear within 35 seconds.' }
    Write-Host 'PASS: the per-user Desktop shortcut opened the dedicated native WPF window.'

    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    $service = $null
    while ([DateTime]::UtcNow -lt $deadline -and -not $service) {
        $service = Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq [IO.Path]::GetFullPath((Join-Path $root 'release\EZ AI Service.exe')) } | Select-Object -First 1
        Start-Sleep -Milliseconds 250
    }
    if (-not $service) { throw 'The package-owned local service was not found.' }
    if ($service.CommandLine -notmatch '--port=0 --no-browser') { throw 'The WPF host did not request an OS-assigned loopback port with browser fallback disabled.' }
    $serviceWindow = Get-Process -Id $service.ProcessId -ErrorAction Stop
    if ($serviceWindow.MainWindowHandle -ne [IntPtr]::Zero) { throw 'The packaged background service created a visible window.' }
    Write-Host 'PASS: packaged service uses OS-assigned port and browser fallback is disabled.'

    $second = Start-Process -FilePath $exe -PassThru
    $second.WaitForExit(5000) | Out-Null
    Start-Sleep -Milliseconds 400
    $hosts = @(Get-Process -Name 'EZ AI' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq [IO.Path]::GetFullPath($exe) })
    if ($hosts.Count -ne 1) { throw "Expected a single native host after repeat launch; found $($hosts.Count)." }
    Write-Host 'PASS: repeat launch restores the existing single instance.'

    $newBrowsers = foreach ($name in $browserNames) { Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $baselineBrowsers[$name] -notcontains $_.Id } }
    if ($newBrowsers.Count -gt 0) { throw 'An external Microsoft Edge browser process appeared during native startup.' }
    Write-Host 'PASS: startup did not create an external Edge browser process.'
} finally {
    if ($hostProcess -and -not $hostProcess.HasExited) {
        [void]$hostProcess.CloseMainWindow()
        $hostProcess.WaitForExit(15000) | Out-Null
    }
    if ($hostProcess -and -not $hostProcess.HasExited) { throw 'EZ AI did not close normally; no process was force-terminated.' }
    Start-Sleep -Milliseconds 500
    $owned = Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq [IO.Path]::GetFullPath((Join-Path $root 'release\EZ AI Service.exe')) -and $serviceIdsBefore -notcontains $_.ProcessId }
    if ($owned) { throw 'The packaged service remained after the host closed normally.' }
    Write-Host 'PASS: closing the WPF host stopped its package-owned local service.'
}
