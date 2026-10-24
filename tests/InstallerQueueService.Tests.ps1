param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { throw 'The Windows .NET Framework C# compiler was not found.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-installer-tests-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
  $exe = Join-Path $temp 'InstallerQueueService.Tests.exe'
  & $csc /nologo /target:exe "/out:$exe" /reference:System.dll /reference:System.Core.dll /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $root 'SoftwareDiscoveryService.cs') (Join-Path $root 'EzAiProfilePaths.cs') (Join-Path $root 'ApplicationActionService.cs') (Join-Path $root 'InstallerQueueService.cs') (Join-Path $PSScriptRoot 'InstallerQueueService.Tests.cs')
  if ($LASTEXITCODE -ne 0) { throw 'Installer queue tests did not compile.' }
  & $exe
  if ($LASTEXITCODE -ne 0) { throw 'Installer queue validation checks failed.' }
} finally {
  $safeRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  $resolved=[IO.Path]::GetFullPath($temp)
  if(-not $resolved.StartsWith($safeRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing unsafe fixture cleanup.'}
  if([IO.Directory]::Exists($resolved)){[IO.Directory]::Delete($resolved,$true)}
}
