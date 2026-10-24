param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $csc)) { throw 'The Windows .NET Framework C# compiler was not found.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-discovery-tests-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    $exe = Join-Path $temp 'SoftwareDiscoveryService.Tests.exe'
    & $csc /nologo /target:exe "/out:$exe" /reference:System.dll /reference:System.Core.dll /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $root 'SoftwareDiscoveryService.cs') (Join-Path $root 'EzAiProfilePaths.cs') (Join-Path $root 'ApplicationActionService.cs') (Join-Path $PSScriptRoot 'SoftwareDiscoveryService.Tests.cs')
    if ($LASTEXITCODE -ne 0) { throw 'The isolated software discovery test runner failed to compile.' }
    & $exe
    if ($LASTEXITCODE -ne 0) { throw 'Software discovery unit checks failed.' }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $resolved = [IO.Path]::GetFullPath($temp)
    if (-not $resolved.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove test files outside the temporary directory.' }
    if ([IO.Directory]::Exists($resolved)) { [IO.Directory]::Delete($resolved, $true) }
}
