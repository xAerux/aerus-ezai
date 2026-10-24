$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$failures = @()
function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { Write-Output "PASS: $Message" } else { $script:failures += $Message; Write-Output "FAIL: $Message" }
}

$helper = Join-Path $root 'installer\EzAiShortcut.ps1'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ezai-shortcut-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
try {
    $installed = Join-Path $temp 'Programs\EZ AI\EZ AI.exe'
    $shell = New-Object -ComObject WScript.Shell
    function New-Link([string]$Name, [string]$Target) {
        $path = Join-Path $temp $Name
        $link = $shell.CreateShortcut($path); $link.TargetPath = $Target; $link.Save()
        return $path
    }
    function Get-Token([string]$ShortcutPath, [string]$Backup = '') {
        $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $helper, '-ShortcutPath', $ShortcutPath, '-ExecutablePath', $installed)
        if ($Backup -ne '') { $args += @('-BackupTo', $Backup) }
        return ((& powershell.exe @args) -join '').Trim()
    }

    Assert-True ((Get-Token (Join-Path $temp 'absent.lnk')) -eq 'MISSING') 'helper reports a missing shortcut as MISSING'
    $exact = New-Link 'exact.lnk' $installed
    Assert-True ((Get-Token $exact) -eq 'EXACT') 'helper reports a shortcut to the installed executable as EXACT'
    $earlier = New-Link 'earlier.lnk' 'C:\Elsewhere\EZ AI.exe'
    $history = Join-Path $temp 'history.txt'
    Assert-True ((Get-Token $earlier $history) -eq 'EZAI') 'helper reports another EZ AI executable as EZAI so an upgrade can retarget it'
    $historyText = Get-Content -LiteralPath $history -Raw
    Assert-True ($historyText.Contains('previous target: C:\Elsewhere\EZ AI.exe')) 'the previous target is recorded before retargeting'
    $other = New-Link 'other.lnk' 'C:\Windows\notepad.exe'
    Assert-True ((Get-Token $other) -eq 'OTHER') 'helper reports an unrelated shortcut as OTHER, so Setup leaves it alone'
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

$service = Get-Content -Raw -LiteralPath (Join-Path $root 'ApplicationActionService.cs')
Assert-True ($service -match 'BundledCompanionPath\("Aerus SDM", "Aerus SDM\.exe"\)') 'SDM lookup puts the bundled copy first'
Assert-True ($service -match 'BundledCompanionPath\("Aerus AI Usage HUD", exe\)') 'HUD lookup puts the bundled copy first'

$launcher = Get-Content -Raw -LiteralPath (Join-Path $root 'EzAiLauncher.cs')
Assert-True ($launcher -match 'private static int ApplicationPort = 62363') 'the service keeps the historical persistent port by default'
Assert-True ($launcher -match 'starting on an available local address for this session') 'a busy persistent port falls back instead of failing the app'

$host_ = Get-Content -Raw -LiteralPath (Join-Path $root 'desktop\DesktopHost.cs')
Assert-True ($host_ -match 'Arguments = "--port=" \+ Program\.PersistentServicePort') 'the host requests the channel persistent port instead of a random port'
Assert-True ($host_ -match 'PersistentServicePort = 62363' -and $host_ -match 'PersistentServicePort = 62364' -and $host_ -match 'PersistentServicePort = 62365') 'each channel has its own persistent port'

$build = Get-Content -Raw -LiteralPath (Join-Path $root 'tools\Build-EzAiDesktop.ps1')
Assert-True ($build -match 'Copy-EzAiCompanion -Source \$SdmSource') 'the build copies the Aerus SDM distribution into Companions'
Assert-True ($build -match 'Copy-EzAiCompanion -Source \$HudSource') 'the build copies the Aerus AI Usage HUD distribution into Companions'
Assert-True ($build -match "Refusing to bundle it") 'the build refuses a companion whose executable identity does not match'
Assert-True ($build -match "Production packaging requires -SdmSource") 'a Production build cannot omit a companion'

$nsi = Get-Content -Raw -LiteralPath (Join-Path $root 'installer\EzAiSetup.nsi')
Assert-True ($nsi -match '!macro EZAI_FAIL' -and $nsi -match 'IfSilent 0 \+3') 'refusal dialogs are skipped in silent runs and exit with a code'
Assert-True ($nsi -match 'IfSilent webview_found 0') 'the WebView2 prompt is skipped in silent runs'
Assert-True ($nsi -match '/DESKTOP') 'the Desktop shortcut can be selected for silent installs'
Assert-True ($nsi -match 'EzAiShortcut\.ps1' -and $nsi -match 'EXACT') 'the Desktop shortcut uses the shortcut helper and only retargets EZ AI shortcuts'
Assert-True ($nsi.Contains('RMDir "$INSTDIR\Installer"')) 'uninstall removes the installer helper folder'

$generator = Get-Content -Raw -LiteralPath (Join-Path $root 'tools\Build-EzAiInstaller.ps1')
Assert-True ($generator.Contains('while ($parent) { [void]$folderSet.Add($parent)')) 'uninstall removes every payload folder, including parents of nested companion folders'
Assert-True ($nsi.Contains('DeleteRegKey /ifempty HKCU "${REG_ROOT}"')) 'uninstall deletes the EZ AI settings key when it is empty'

if ($failures.Count -gt 0) { Write-Output "Companion packaging checks failed: $($failures.Count)"; exit 1 }
Write-Output 'Companion packaging checks passed.'
