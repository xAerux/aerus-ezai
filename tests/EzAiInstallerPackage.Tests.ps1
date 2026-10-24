param(
    [switch]$RunInstallIntegration,
    [string]$Version = '1.0.0-beta.1',
    [string]$ReleaseDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release'),
    [string]$InstallerPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release-artifacts\EZ-AI-Setup-v1.0.0-beta.1.exe')
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$manifest = Get-Content (Join-Path $release "EZ-AI-v$Version-build-manifest.json") -Raw | ConvertFrom-Json
$setupScript = Get-Content (Join-Path $root 'installer\EzAiSetup.nsi') -Raw
if (-not (Test-Path $installer -PathType Leaf)) { throw 'Build the installer first.' }
if ($manifest.version -ne $Version) { throw 'Release manifest version mismatch.' }
if ($setupScript -notmatch 'RequestExecutionLevel user') { throw 'Installer is not configured for per-user execution.' }
if ($setupScript -match 'RMDir\s+/r') { throw 'Uninstaller uses recursive folder removal.' }
if ($setupScript -notmatch 'https://developer\.microsoft\.com/microsoft-edge/webview2/') { throw 'Missing the official WebView2 prerequisite link.' }
if ($setupScript -match 'ExecShell\s+"open"\s+"(?!https://developer\.microsoft\.com/microsoft-edge/webview2/)') { throw 'Installer contains an unapproved external launch target.' }
if ($manifest.files.path -notcontains 'NSIS-COPYING.txt') { throw 'Release manifest omits the NSIS license notice.' }
$signature = Get-AuthenticodeSignature -LiteralPath $installer
$installerHash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "PASS: static installer safety and release metadata. Setup SHA-256 $installerHash; signature $($signature.Status)."
if (-not $RunInstallIntegration) { return }

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\EZ AI'
if (Test-Path $uninstallKey) { throw 'Refusing integration test because an EZ AI Apps & Features registration already exists.' }
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopLink = Join-Path $desktop 'EZ AI.lnk'
$desktopBefore = if (Test-Path $desktopLink) { (Get-FileHash $desktopLink -Algorithm SHA256).Hash } else { $null }
$startMenu = [Environment]::GetFolderPath('Programs')
$menuFolder = Join-Path $startMenu 'EZ AI'
if (Test-Path (Join-Path $menuFolder 'EZ AI.lnk')) { throw 'Refusing integration test because an EZ AI Start Menu shortcut already exists.' }
$profileRoot = Join-Path $env:LOCALAPPDATA 'EZ AI'
function Get-ProfileSnapshot {
    if (-not (Test-Path $profileRoot)) { return @{} }
    $snapshot = @{}
    foreach ($file in Get-ChildItem -LiteralPath $profileRoot -File -Recurse -ErrorAction Stop) {
        $rel = $file.FullName.Substring($profileRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
        $snapshot[$rel] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
    return $snapshot
}
function Assert-SnapshotEqual($before, $after, $label) {
    $diff = Compare-Object @($before.Keys | Sort-Object) @($after.Keys | Sort-Object)
    if ($diff) { throw "$label changed EZ AI profile file membership." }
    foreach ($key in $before.Keys) { if ($before[$key] -ne $after[$key]) { throw "$label modified existing EZ AI profile file: $key" } }
}
$profileBefore = Get-ProfileSnapshot
$testRoot = Join-Path $env:TEMP ('ez-ai-rc01b-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$installDir = Join-Path $testRoot 'Program Files\EZ AI'
$installExit = $null
try {
    $p = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
    $installExit = $p.ExitCode
    if ($installExit -ne 0) { throw "Silent temporary installation failed with exit code $installExit." }
    if (-not (Test-Path (Join-Path $installDir 'EZ AI.exe'))) { throw 'Installer did not place the native executable in its selected per-user target.' }
    if (-not (Test-Path (Join-Path $installDir 'Uninstall.exe'))) { throw 'Installer did not place the uninstaller.' }
    $reg = Get-ItemProperty $uninstallKey
    $expectedUninstaller = '"' + (Join-Path $installDir 'Uninstall.exe') + '"'
    if ($reg.UninstallString -ne $expectedUninstaller) { throw "Apps & Features uninstall target is invalid: $($reg.UninstallString)" }
    if ($reg.DisplayIcon -ne (Join-Path $installDir 'EZ AI.exe,0')) { throw 'Apps & Features icon metadata is wrong.' }
    if ([int]$reg.EstimatedSize -lt 1000) { throw 'Apps & Features estimated size is implausible.' }
    if ($reg.DisplayVersion -ne $Version) { throw 'Apps & Features version metadata is wrong.' }
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $menuFolder 'EZ AI.lnk'))
    if ([IO.Path]::GetFullPath($shortcut.TargetPath) -ne [IO.Path]::GetFullPath((Join-Path $installDir 'EZ AI.exe'))) { throw 'Start Menu shortcut target is wrong.' }
    foreach ($record in $manifest.files) {
        $installed = Join-Path $installDir ($record.path.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) { throw "Installed manifest file is missing: $($record.path)" }
        $item = Get-Item -LiteralPath $installed
        if ($item.Length -ne [long]$record.bytes -or (Get-FileHash $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256.ToLowerInvariant()) { throw "Installed manifest file mismatch: $($record.path)" }
    }
    Write-Output "PASS: first install, Apps & Features registration, Start Menu target, and all $($manifest.files.Count) manifest file hashes."
    Assert-SnapshotEqual $profileBefore (Get-ProfileSnapshot) 'Install'

    $browserNames = @('msedge','chrome','firefox','brave','opera','vivaldi','iexplore')
    $browserBefore = @{}; foreach ($name in $browserNames) { $browserBefore[$name] = @(Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object Id) }
    $hostProcess = Start-Process -FilePath (Join-Path $installDir 'EZ AI.exe') -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(35); $window = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        $hostProcess.Refresh()
        if ($hostProcess.HasExited) { throw "Installed native host exited with $($hostProcess.ExitCode)." }
        if ($hostProcess.MainWindowHandle -ne [IntPtr]::Zero -and $hostProcess.MainWindowTitle -eq 'EZ AI') { $window = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $window) { throw 'Installed WPF window did not appear within 35 seconds.' }
    $servicePath = [IO.Path]::GetFullPath((Join-Path $installDir 'EZ AI Service.exe'))
    $deadline = [DateTime]::UtcNow.AddSeconds(10); $service = $null
    while ([DateTime]::UtcNow -lt $deadline -and -not $service) {
        $service = Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $servicePath } | Select-Object -First 1
        Start-Sleep -Milliseconds 250
    }
    if (-not $service) { throw 'Installed native host did not start its package-owned local service.' }
    $newBrowsers = foreach ($name in $browserNames) { Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $browserBefore[$name] -notcontains $_.Id } }
    if ($newBrowsers) { throw 'An external browser process appeared during installed-app startup.' }
    [void]$hostProcess.CloseMainWindow()
    if (-not $hostProcess.WaitForExit(15000)) { throw 'Installed EZ AI did not close normally.' }
    Start-Sleep -Milliseconds 500
    if (Get-CimInstance Win32_Process -Filter "Name='EZ AI Service.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $servicePath }) { throw 'The installed package-owned service remained after normal application close.' }
    Write-Output 'PASS: installed executable opened a WPF window, started its local service, created no external browser, and shut down normally.'
    $profileBeforeUpgrade = Get-ProfileSnapshot

    $upgrade = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
    if ($upgrade.ExitCode -ne 0) { throw "Same-version upgrade/reinstall returned $($upgrade.ExitCode)." }
    foreach ($record in $manifest.files) {
        $installed = Join-Path $installDir ($record.path.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if ((Get-FileHash $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256.ToLowerInvariant()) { throw "Upgrade payload mismatch: $($record.path)" }
    }
    Assert-SnapshotEqual $profileBeforeUpgrade (Get-ProfileSnapshot) 'Upgrade'
    Write-Output 'PASS: same-version upgrade retained verified files and left the EZ AI user profile unchanged.'

    $uninstall = Start-Process -FilePath (Join-Path $installDir 'Uninstall.exe') -ArgumentList '/S' -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Temporary uninstall returned $($uninstall.ExitCode)." }
    if (Test-Path $uninstallKey) { throw 'Uninstall left the EZ AI Apps & Features registration.' }
    if (Test-Path $menuFolder) { throw 'Uninstall left the EZ AI Start Menu folder.' }
    if (Test-Path $installDir) { throw 'Uninstall left files in the temporary EZ AI install directory.' }
    Assert-SnapshotEqual $profileBeforeUpgrade (Get-ProfileSnapshot) 'Uninstall'
    if ($desktopBefore) { if ((Get-FileHash $desktopLink -Algorithm SHA256).Hash -ne $desktopBefore) { throw 'Installer/uninstaller modified the pre-existing Desktop shortcut.' } }
    elseif (Test-Path $desktopLink) { throw 'Installer created a Desktop shortcut without the optional component being selected.' }
    Write-Output 'PASS: uninstaller removed app-owned install/registration/Start Menu files and preserved profile data and Desktop shortcut.'

    $reinstall = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
    if ($reinstall.ExitCode -ne 0 -or -not (Test-Path (Join-Path $installDir 'EZ AI.exe'))) { throw 'Reinstall after uninstall failed.' }
    $reuninstall = Start-Process -FilePath (Join-Path $installDir 'Uninstall.exe') -ArgumentList '/S' -Wait -PassThru
    if ($reuninstall.ExitCode -ne 0 -or (Test-Path $installDir)) { throw 'Reinstall cleanup did not complete.' }
    Assert-SnapshotEqual $profileBeforeUpgrade (Get-ProfileSnapshot) 'Reinstall/uninstall'
    Write-Output 'PASS: reinstall after uninstall completed and preserved the EZ AI user profile.'
} finally {
    if (Test-Path (Join-Path $installDir 'Uninstall.exe')) {
        $cleanup = Start-Process -FilePath (Join-Path $installDir 'Uninstall.exe') -ArgumentList '/S' -Wait -PassThru
        if ($cleanup.ExitCode -ne 0) { Write-Warning "Temporary install cleanup returned $($cleanup.ExitCode); preserved test path: $installDir" }
    }
    if (Test-Path $installDir) { Write-Warning "Temporary installer test files remain for safe inspection: $installDir" }
}
