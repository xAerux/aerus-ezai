$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(!(Test-Path -LiteralPath $csc)){throw "C# compiler not found: $csc"}
$tempRoot=Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-model-service-tests-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
try {
  $exe=Join-Path $tempRoot 'ModelManagementService.Tests.exe'
  $framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
  $compilerArgs=@('/nologo','/target:exe',('/out:'+ $exe),('/reference:'+ (Join-Path $framework 'System.dll')),('/reference:'+ (Join-Path $framework 'System.Core.dll')),('/reference:'+ (Join-Path $framework 'System.Web.Extensions.dll')),(Join-Path $root 'ModelManagementService.cs'),(Join-Path $root 'tests\ModelManagementService.Tests.cs'))
  & $csc @compilerArgs
  if($LASTEXITCODE -ne 0){throw 'Model management fixture test compile failed.'}
  & $exe
  if($LASTEXITCODE -ne 0){throw 'Model management fixture tests failed.'}
} finally {
  $resolved=(Resolve-Path -LiteralPath $tempRoot).Path
  $tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if($resolved.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase) -and $resolved -like '*ez-ai-model-service-tests-*'){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
