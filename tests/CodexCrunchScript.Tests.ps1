$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$html = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'public\knowledge\codex-efficiency-setup.html')
$match = [regex]::Match($html, '<code id="ps1-body">([\s\S]*?)</code></pre>')
if (-not $match.Success) { throw 'Setup script block not found in the Codex guide.' }
$script = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
$work = Join-Path ([IO.Path]::GetTempPath()) ('ezai-codex-script-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $file = Join-Path $work 'setup-codex-efficiency.ps1'
    [IO.File]::WriteAllText($file, $script, [Text.Encoding]::ASCII)
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($file, [ref]$null, [ref]$errors)
    if (@($errors).Count -gt 0) { throw "Setup script has $(@($errors).Count) parse error(s)." }
    Write-Output 'PASS: setup script parses under Windows PowerShell'

    # Declining all three steps must change nothing. CODEX_HOME points at a folder with spaces and Unicode.
    $home2 = Join-Path $work 'codex home 雪'
    $env:CODEX_HOME = $home2
    $output = @('n', 'n', 'n') | & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $file 2>&1 | Out-String
    Remove-Item Env:\CODEX_HOME
    if ($output -notmatch 'No Codex files were changed') { throw 'Declining Step B did not report that nothing was changed.' }
    if ($output -notmatch 'No agent files were written') { throw 'Declining Step C did not report that nothing was written.' }
    if (Test-Path -LiteralPath $home2) { throw 'Declining created the Codex folder.' }
    Write-Output 'PASS: declining every step changes nothing and honours CODEX_HOME'
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output 'Codex Crunch script checks passed.'
