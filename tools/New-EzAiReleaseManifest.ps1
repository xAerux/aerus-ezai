param(
    [Parameter(Mandatory=$true)][string]$ReleaseDirectory,
    [string]$Version = (Get-Content -Raw -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'package.json') | ConvertFrom-Json).version
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$exe = Join-Path $root 'EZ AI.exe'
$service = Join-Path $root 'EZ AI Service.exe'
$index = Join-Path $root 'dist\index.html'
foreach ($required in @($exe, $service, $index, (Join-Path $root 'ez-ai.ico'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required release component is missing: $([IO.Path]::GetFileName($required))" }
}
$identityPath = Join-Path $root 'dist\build-identity.json'
if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf)) { throw 'build-identity.json is missing from the release dist folder; rebuild the package.' }
$build = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
if ($build.version -ne $Version) { throw "build-identity.json version $($build.version) does not match the manifest version $Version. Refusing to mix a stale UI with this package." }
$manifestName = "EZ-AI-v$Version-build-manifest.json"
$checksumsName = "EZ-AI-v$Version-SHA256SUMS.txt"
$exclude = @($manifestName, $checksumsName)
$files = Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object { $exclude -notcontains $_.Name } | Sort-Object FullName
$records = foreach ($file in $files) {
    [pscustomobject]@{
        path = $file.FullName.Substring($root.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace('\','/')
        bytes = [long]$file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$manifest = [ordered]@{
    product = 'EZ AI'
    version = $Version
    target = 'Windows 11 x64'
    packageType = 'Native WPF/WebView2 application folder; not an installer'
    buildTimeUtc = [DateTime]::UtcNow.ToString('o')
    build = $build
    signatureStatus = 'Unsigned; publisher identity is not established'
    prerequisites = @('.NET Framework 4.8-compatible Windows components', 'Microsoft Edge WebView2 Evergreen Runtime')
    files = @($records)
}
$manifestPath = Join-Path $root $manifestName
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$sumFiles = Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object { $_.Name -ne $checksumsName } | Sort-Object FullName
$sumLines = foreach ($file in $sumFiles) {
    $relative = $file.FullName.Substring($root.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace('\','/')
    '{0}  {1}' -f (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relative
}
Set-Content -LiteralPath (Join-Path $root $checksumsName) -Value $sumLines -Encoding ASCII
