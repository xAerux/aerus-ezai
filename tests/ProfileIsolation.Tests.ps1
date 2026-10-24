$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-profile-tests-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    $exe = Join-Path $temp 'ProfileIsolation.Tests.exe'
    & $csc /nologo /target:exe "/out:$exe" /reference:System.dll /reference:System.Core.dll (Join-Path $root 'EzAiProfilePaths.cs') (Join-Path $PSScriptRoot 'ProfileIsolation.Tests.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Profile-isolation tests failed to compile.' }
    & $exe
    if ($LASTEXITCODE -ne 0) { throw 'Profile-isolation tests failed.' }
} finally {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolved = [IO.Path]::GetFullPath($temp)
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside temporary directory.' }
    if ([IO.Directory]::Exists($resolved)) { [IO.Directory]::Delete($resolved, $true) }
}
