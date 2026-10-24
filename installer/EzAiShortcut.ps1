# Shortcut helper for EZ AI Setup and its uninstaller. Runs only from the installer's temporary folder.
# Usage: EzAiShortcut.ps1 -ShortcutPath <path> -ExecutablePath <installed EZ AI.exe> [-BackupTo <file>]
# Prints one token: MISSING (no shortcut), EXACT (targets the installed executable), EZAI (targets some
# EZ AI.exe elsewhere, such as an earlier install), or OTHER (targets something else). Prints nothing else.
param(
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [string]$BackupTo = ''
)
$ErrorActionPreference = 'Stop'
try {
    if (-not (Test-Path -LiteralPath $ShortcutPath)) { [Console]::Out.Write('MISSING'); exit 0 }
    $target = (New-Object -ComObject WScript.Shell).CreateShortcut($ShortcutPath).TargetPath
    if ([string]::IsNullOrEmpty($target)) { [Console]::Out.Write('OTHER'); exit 0 }
    if ($BackupTo -ne '') {
        $folder = Split-Path -Parent $BackupTo
        if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
        Add-Content -LiteralPath $BackupTo -Encoding UTF8 -Value ((Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') + '  ' + $ShortcutPath + '  previous target: ' + $target)
    }
    if ([string]::Equals($target, $ExecutablePath, [StringComparison]::OrdinalIgnoreCase)) { [Console]::Out.Write('EXACT'); exit 0 }
    if ($target -like '*\EZ AI.exe') { [Console]::Out.Write('EZAI'); exit 0 }
    [Console]::Out.Write('OTHER')
} catch {
    [Console]::Out.Write('OTHER')
}
