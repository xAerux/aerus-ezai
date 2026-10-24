param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ReleaseDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release'),
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release-artifacts'),
    [string]$Version = (Get-Content -Raw -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'package.json') | ConvertFrom-Json).version,
    [string]$Compiler = (Join-Path (Split-Path -Parent $PSScriptRoot) 'build-tools\nsis-3.13\portable\nsis-3.13\makensis.exe')
)

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+-beta\.\d+$') { throw 'Version must use the numeric beta form x.y.z-beta.n.' }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ReleaseDirectory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$manifestPath = Join-Path $ReleaseDirectory "EZ-AI-v$Version-build-manifest.json"
$checksumsPath = Join-Path $ReleaseDirectory "EZ-AI-v$Version-SHA256SUMS.txt"
foreach ($path in @($manifestPath, $checksumsPath, $Compiler, (Join-Path $ProjectRoot 'installer\EzAiSetup.nsi'))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required installer input is missing: $path" }
}

$compilerVersion = ((& $Compiler -VERSION) -join "").Trim()
if ($compilerVersion -ne 'v3.13') { throw "Expected verified NSIS v3.13, found $compilerVersion" }
$nsisLicense = Join-Path (Split-Path -Parent $Compiler) 'COPYING'
if (-not (Test-Path -LiteralPath $nsisLicense -PathType Leaf)) { throw "NSIS license/notice file is missing: $nsisLicense" }
Copy-Item -LiteralPath $nsisLicense -Destination (Join-Path $ReleaseDirectory 'NSIS-COPYING.txt') -Force
& (Join-Path $ProjectRoot 'tools\New-EzAiReleaseManifest.ps1') -ReleaseDirectory $ReleaseDirectory -Version $Version
if (-not $?) { throw 'Failed to refresh release manifest after adding NSIS notice.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.product -ne 'EZ AI' -or $manifest.version -ne $Version -or $manifest.target -ne 'Windows 11 x64') {
    throw 'Release manifest product/version/target does not match the requested installer.'
}
if ($manifest.signatureStatus -notmatch '^Unsigned') { throw 'Expected this beta package to be explicitly identified as unsigned.' }

$files = @($manifest.files)
if ($files.Count -lt 5) { throw 'Release manifest contains too few payload files.' }
$hudFiles = @($files | Where-Object { $_.path -like 'Companions/Aerus AI Usage HUD/*' })
if (-not ($hudFiles.path -contains 'Companions/Aerus AI Usage HUD/Aerus AI Usage HUD.exe')) { throw 'The release manifest lacks the bundled Aerus AI Usage HUD.' }
if (@($files | Where-Object { $_.path -match '(?i)Codex Usage HUD|CODEX Monitor|(^|/)(data|logs|snapshots)/|\.jsonl$|\.sqlite|\.db$|\.pdb$|\.log$|(?i:setup|installer).*\.exe$' }).Count -gt 0) { throw 'The release manifest contains a retired HUD, nested installer, or private data.' }
$totalBytes = 0L
foreach ($record in $files) {
    if ([IO.Path]::IsPathRooted($record.path) -or $record.path -match '(^|/)\.\.(/|$)') { throw "Unsafe manifest path: $($record.path)" }
    $path = Join-Path $ReleaseDirectory ($record.path.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $resolved = (Resolve-Path -LiteralPath $path).Path
    $prefix = $ReleaseDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Manifest path escapes release root: $($record.path)" }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Manifest payload is missing: $($record.path)" }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing a reparse-point payload: $($record.path)" }
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $record.sha256.ToLowerInvariant() -or $item.Length -ne [long]$record.bytes) { throw "Release payload does not match its manifest: $($record.path)" }
    $totalBytes += [long]$record.bytes
}
$expectedPaths = @($files | ForEach-Object { $_.path.Replace('/', '\') } | Sort-Object -Unique)
$actualPaths = @(Get-ChildItem -LiteralPath $ReleaseDirectory -File -Recurse | Where-Object { $_.Name -notin @((Split-Path $manifestPath -Leaf),(Split-Path $checksumsPath -Leaf)) } | ForEach-Object { $_.FullName.Substring($ReleaseDirectory.Length).TrimStart([IO.Path]::DirectorySeparatorChar) } | Sort-Object -Unique)
if (Compare-Object $expectedPaths $actualPaths) { throw 'The release folder contains unmanifested files or does not match the manifest.' }

# Verify the release checksum list itself before packaging it for installed-file verification.
foreach ($line in Get-Content -LiteralPath $checksumsPath) {
    if ($line -match '^([0-9a-fA-F]{64})  (.+)$') {
        $path = Join-Path $ReleaseDirectory ($Matches[2].Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Checksum-list file is missing: $($Matches[2])" }
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Matches[1]) { throw "Checksum-list mismatch: $($Matches[2])" }
    } else { throw "Invalid checksum-list entry: $line" }
}

$generatedRoot = Join-Path $ProjectRoot 'build-tools\installer-generated'
New-Item -ItemType Directory -Path $generatedRoot -Force | Out-Null
$includePath = Join-Path $generatedRoot 'EzAiPayload.nsh'
$payload = [System.Collections.Generic.List[string]]::new()
$payload.Add('!macro InstallPayload')
foreach ($record in $files) {
    $relative = $record.path.Replace('/', '\')
    $folder = Split-Path $relative -Parent
    $destination = if ($folder) { '$INSTDIR\' + $folder } else { '$INSTDIR' }
    $payload.Add('  SetOutPath "' + $destination + '"')
    $payload.Add('  File "${RELEASE_DIR}\' + $relative + '"')
}
foreach ($metadata in @((Split-Path $manifestPath -Leaf),(Split-Path $checksumsPath -Leaf))) {
    $payload.Add('  SetOutPath "$INSTDIR"')
    $payload.Add('  File "${RELEASE_DIR}\' + $metadata + '"')
}
$payload.Add('!macroend')
$payload.Add('!macro UninstallPayload')
$payload.Add('  Delete "$INSTDIR\EZ-AI-v' + $Version + '-build-manifest.json"')
$payload.Add('  Delete "$INSTDIR\EZ-AI-v' + $Version + '-SHA256SUMS.txt"')
foreach ($record in $files) { $payload.Add('  Delete "$INSTDIR\' + $record.path.Replace('/', '\') + '"') }
# Every folder the payload creates, including parents of nested folders, so an uninstall leaves nothing empty behind.
$folderSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($record in $files) {
    $parent = Split-Path $record.path.Replace('/', '\') -Parent
    while ($parent) { [void]$folderSet.Add($parent); $parent = Split-Path $parent -Parent }
}
$folders = @($folderSet | Sort-Object { $_.Length } -Descending)
foreach ($folder in $folders) { $payload.Add('  RMDir "$INSTDIR\' + $folder + '"') }
$payload.Add('!macroend')
Set-Content -LiteralPath $includePath -Value $payload -Encoding ASCII

$estimatedKb = [Math]::Ceiling(($totalBytes + (Get-Item $manifestPath).Length + (Get-Item $checksumsPath).Length) / 1024)
$compilerOutput = Join-Path $OutputDirectory "EZ-AI-Setup-v$Version.exe"
$old = Join-Path $OutputDirectory "EZ-AI-Setup-v$Version-beta.1.exe"
if (Test-Path -LiteralPath $old) { throw "Unexpected legacy installer naming collision: $old" }
$arguments = @(
    "/DRELEASE_DIR=$ReleaseDirectory",
    "/DAPP_VERSION=$Version",
    "/DAPP_VERSION_NUMBER=$($Version -replace '-beta\.', '.')",
    "/DGENERATED_INCLUDE=$includePath",
    "/DOUTPUT_DIR=$OutputDirectory",
    "/DESTIMATED_SIZE_KB=$estimatedKb",
    '/V3',
    (Join-Path $ProjectRoot 'installer\EzAiSetup.nsi')
)
& $Compiler @arguments
if ($LASTEXITCODE -ne 0) { throw "NSIS compiler failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $compilerOutput -PathType Leaf)) { throw 'NSIS did not produce the expected versioned setup executable.' }
$setup = Get-Item -LiteralPath $compilerOutput
$sha = (Get-FileHash -LiteralPath $compilerOutput -Algorithm SHA256).Hash.ToLowerInvariant()
$sig = Get-AuthenticodeSignature -LiteralPath $compilerOutput
$inventoryPath = Join-Path $OutputDirectory "EZ-AI-Setup-v$Version-inventory.txt"
$inventory = [System.Collections.Generic.List[string]]::new()
$inventory.Add("Installer: $(Split-Path $compilerOutput -Leaf)")
$inventory.Add("Release-manifest payload files: $($files.Count)")
$inventory.Add('Install-relative path | bytes | SHA-256')
foreach ($record in $files) { $inventory.Add("$($record.path) | $($record.bytes) | $($record.sha256)") }
$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumHash = (Get-FileHash -LiteralPath $checksumsPath -Algorithm SHA256).Hash.ToLowerInvariant()
$inventory.Add("EZ-AI-v$Version-build-manifest.json | $((Get-Item $manifestPath).Length) | $manifestHash")
$inventory.Add("EZ-AI-v$Version-SHA256SUMS.txt | $((Get-Item $checksumsPath).Length) | $checksumHash")
$inventory.Add('Uninstall.exe | generated by NSIS during installation; dynamic per build')
$inventory.Add('Start Menu shortcut: EZ AI\EZ AI.lnk | generated during installation')
$inventory.Add('Desktop shortcut: optional component; existing link is preserved')
Set-Content -LiteralPath $inventoryPath -Value $inventory -Encoding UTF8
[pscustomobject]@{Path=$setup.FullName;Bytes=$setup.Length;Sha256=$sha;Signature=$sig.Status;ReleaseFiles=$files.Count;ReleasePayloadBytes=$totalBytes;NSISVersion=((& $Compiler -VERSION) -join '').Trim();Inventory=$inventoryPath} | Format-List
