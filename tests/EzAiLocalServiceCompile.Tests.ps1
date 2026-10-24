$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc = Join-Path $framework 'csc.exe'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-local-service-compile-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    $exe = Join-Path $temp 'EZ-AI-Service-compile-check.exe'
    & $csc /nologo /target:exe "/out:$exe" `
        "/reference:$(Join-Path $framework 'System.dll')" `
        "/reference:$(Join-Path $framework 'System.Core.dll')" `
        "/reference:$(Join-Path $framework 'System.Management.dll')" `
        "/reference:$(Join-Path $framework 'System.Web.Extensions.dll')" `
        "/reference:$(Join-Path $framework 'System.Windows.Forms.dll')" `
        (Join-Path $root 'EzAiLauncher.cs') `
        (Join-Path $root 'HardwareScanService.cs') `
        (Join-Path $root 'SoftwareDiscoveryService.cs') `
        (Join-Path $root 'ApplicationActionService.cs') `
        (Join-Path $root 'EzAiProfilePaths.cs') `
        (Join-Path $root 'InstallerQueueService.cs') `
        (Join-Path $root 'ModelManagementService.cs') `
        (Join-Path $root 'InstructionInstallerService.cs')
    if ($LASTEXITCODE -ne 0) { throw 'The local service compilation check failed.' }
    if (-not [IO.File]::Exists($exe)) { throw 'Compiler returned success without producing the temporary service binary.' }
    Write-Output 'EZ AI local service compilation passed (temporary output only; release package untouched).'
} finally {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolved = [IO.Path]::GetFullPath($temp)
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside the temporary directory.' }
    if ([IO.Directory]::Exists($resolved)) { [IO.Directory]::Delete($resolved, $true) }
}
