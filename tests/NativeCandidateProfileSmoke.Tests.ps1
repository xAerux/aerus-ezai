param([Parameter(Mandatory=$true)][string]$CandidateDirectory)
$ErrorActionPreference = 'Stop'
$candidateRoot = (Resolve-Path -LiteralPath $CandidateDirectory).Path
$exe = Join-Path $candidateRoot 'EZ AI.exe'
$serviceExe = Join-Path $candidateRoot 'EZ AI Service.exe'
if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath $serviceExe)) { throw 'Candidate package is incomplete.' }
$canonical = [IO.Path]::GetFullPath($candidateRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).ToUpperInvariant()
$sha = [Security.Cryptography.SHA256]::Create()
try { $bytes = [Text.Encoding]::UTF8.GetBytes($canonical); $digest = $sha.ComputeHash($bytes); $id = -join ($digest[0..7] | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
$profile = Join-Path (Join-Path (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'EZ AI') (Join-Path 'Candidates' $id)) 'WebView2'
$titlePrefix = "EZ AI [Candidate "
$hostProcess = $null
$serviceIdsBefore = @(Get-Process -Name 'EZ AI Service' -ErrorAction SilentlyContinue | ForEach-Object Id)
$browserNames = @('msedge','chrome','firefox','brave','opera','vivaldi','iexplore')
$browserBaseline = @{}
foreach ($name in $browserNames) { $browserBaseline[$name] = @(Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object Id) }
try {
    $hostProcess = Start-Process -FilePath $exe -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(40)
    while ([DateTime]::UtcNow -lt $deadline) {
        $hostProcess.Refresh()
        if ($hostProcess.HasExited) { throw "Candidate host exited during startup (code $($hostProcess.ExitCode))." }
        if ($hostProcess.MainWindowHandle -ne [IntPtr]::Zero -and $hostProcess.MainWindowTitle.StartsWith($titlePrefix, [StringComparison]::Ordinal)) { break }
        Start-Sleep -Milliseconds 250
    }
    if ($hostProcess.MainWindowHandle -eq [IntPtr]::Zero -or !$hostProcess.MainWindowTitle.StartsWith($titlePrefix, [StringComparison]::Ordinal)) { throw 'The isolated candidate WPF window did not appear with its candidate identity.' }
    $profileDeadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $profileDeadline -and !(Test-Path -LiteralPath $profile)) {
        $hostProcess.Refresh()
        if ($hostProcess.HasExited) { throw "Candidate host exited before WebView2 profile initialization (code $($hostProcess.ExitCode))." }
        Start-Sleep -Milliseconds 200
    }
    if (!(Test-Path -LiteralPath $profile)) { throw "Candidate WebView2 data did not initialize at its isolated profile path: $profile" }
    Write-Host "PASS: candidate opened in its dedicated native window and profile: $profile"

    $service = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    while ([DateTime]::UtcNow -lt $deadline -and !$service) {
        $service = Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq [IO.Path]::GetFullPath($serviceExe) } | Select-Object -First 1
        Start-Sleep -Milliseconds 200
    }
    if (!$service -or $service.CommandLine -notmatch '--port=0 --no-browser') { throw 'The candidate-owned local service did not start with its supported isolated host flow.' }
    if ((Get-Process -Id $service.ProcessId).MainWindowHandle -ne [IntPtr]::Zero) { throw 'Candidate local service unexpectedly showed a console window.' }
    Write-Host 'PASS: candidate starts its own hidden local service with browser fallback disabled.'

    $second = Start-Process -FilePath $exe -PassThru
    if (!$second.WaitForExit(8000)) { throw 'The second candidate launch did not exit after signaling its own single-instance window.' }
    Start-Sleep -Milliseconds 350
    $candidateHosts = @(Get-Process -Name 'EZ AI' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq [IO.Path]::GetFullPath($exe) })
    if ($candidateHosts.Count -ne 1) { throw "Expected one candidate window after relaunch; found $($candidateHosts.Count)." }
    Write-Host 'PASS: candidate relaunch uses a candidate-specific mutex and leaves one candidate host.'

    $newBrowsers = foreach ($name in $browserNames) { Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $browserBaseline[$name] -notcontains $_.Id } }
    if ($newBrowsers.Count -gt 0) { throw 'Candidate startup created an external browser process.' }
    Write-Host 'PASS: native candidate startup did not open an external browser.'
} finally {
    if ($hostProcess -and !$hostProcess.HasExited) {
        [void]$hostProcess.CloseMainWindow()
        if (!$hostProcess.WaitForExit(15000)) { throw 'Candidate did not close normally; no process was force-terminated.' }
    }
    Start-Sleep -Milliseconds 400
    $ownedServices = @(Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq [IO.Path]::GetFullPath($serviceExe) -and $serviceIdsBefore -notcontains $_.ProcessId })
    if ($ownedServices.Count -gt 0) { throw 'Candidate service remained after normal host shutdown.' }
    Write-Host 'PASS: candidate closes normally and stops its owned service.'
}
