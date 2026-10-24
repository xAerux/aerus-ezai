param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release'),
    [string]$Version = (Get-Content -Raw -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'package.json') | ConvertFrom-Json).version,
    [ValidateSet('Production', 'Development', 'Candidate')]
    [string]$ProfileMode = 'Production',
    [switch]$UpdateDesktopShortcut,
    [string]$SdmSource = '',
    [string]$HudSource = '',
    [string]$ShortcutPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'EZ AI.lnk')
)

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+-beta\.\d+$') { throw 'Version must use the numeric beta form x.y.z-beta.n.' }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$officialRelease = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'release'))
if (Test-Path -LiteralPath (Join-Path $OutputDirectory 'Companions\Codex Usage HUD')) {
    throw 'The output still contains the retired Codex Usage HUD bundle. Preserve or archive that folder before building; it must not ship alongside Aerus AI Usage HUD.'
}
if ($ProfileMode -ne 'Production' -and [String]::Equals($OutputDirectory, $officialRelease, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Development and candidate profiles must be built outside the production release directory.'
}
if ($ProfileMode -eq 'Production' -and -not [String]::Equals($OutputDirectory, $officialRelease, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'A build outside the official release directory must explicitly select Development or Candidate profile mode.'
}
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$gac = Join-Path $env:WINDIR 'Microsoft.NET\assembly'
$presentationFramework = Get-ChildItem (Join-Path $gac 'GAC_MSIL\PresentationFramework') -Recurse -Filter PresentationFramework.dll | Select-Object -First 1 -ExpandProperty FullName
$presentationCore = Get-ChildItem (Join-Path $gac 'GAC_64\PresentationCore') -Recurse -Filter PresentationCore.dll | Select-Object -First 1 -ExpandProperty FullName
$windowsBase = Get-ChildItem (Join-Path $gac 'GAC_MSIL\WindowsBase') -Recurse -Filter WindowsBase.dll | Select-Object -First 1 -ExpandProperty FullName
$systemXaml = Get-ChildItem (Join-Path $gac 'GAC_MSIL\System.Xaml') -Recurse -Filter System.Xaml.dll | Select-Object -First 1 -ExpandProperty FullName
$webViewPackage = Join-Path $env:USERPROFILE '.nuget\packages\microsoft.web.webview2\1.0.4258.31'
if (!(Test-Path -LiteralPath $csc)) { throw ".NET Framework C# compiler not found: $csc" }
if (!(Test-Path -LiteralPath (Join-Path $webViewPackage 'lib\net462\Microsoft.Web.WebView2.Wpf.dll'))) { throw 'Cached Microsoft WebView2 1.0.4258.31 package is required to build the desktop host.' }

# Copies a complete companion application distribution. Installer scripts, shortcuts and debug symbols are not shipped.
function Copy-EzAiCompanion([string]$Source, [string]$Destination, [string]$Executable, [string]$Product, [string]$Company, [string[]]$Required) {
    if ($Source -match '\.(exe|msi)$') { throw 'Companion source must be an unpacked distributable folder, not an installer.' }
    $sourceRoot = (Resolve-Path -LiteralPath $Source).Path
    if ($Product -eq 'Aerus AI Usage HUD' -and (Test-Path -LiteralPath (Join-Path $sourceRoot 'data'))) { throw 'Refusing to bundle companion user data.' }
    if ((Get-Item -LiteralPath $sourceRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to bundle a linked companion folder.' }
    foreach ($item in $Required) {
        if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $item))) { throw "Companion distribution is incomplete: $item is missing from $sourceRoot" }
    }
    $exeInfo = (Get-Item -LiteralPath (Join-Path $sourceRoot $Executable)).VersionInfo
    if ($exeInfo.ProductName -ne $Product -or $exeInfo.CompanyName.TrimEnd('.') -ne $Company) {
        throw "Companion executable identity does not match $Product ($Company). Refusing to bundle it."
    }
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $excluded = @('*.lnk', '*.pdb', 'Install*.bat', 'Install*.ps1', 'Setup-*.cmd', 'Install*.cmd')
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {
        if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing to bundle a linked companion file: $($file.Name)" }
        if ($Product -eq 'Aerus AI Usage HUD' -and $file.FullName.Substring($sourceRoot.Length) -match '[\\/](data|logs|snapshots)[\\/]') { throw "Refusing to bundle private companion data: $($file.Name)" }
        if ($Product -eq 'Aerus AI Usage HUD' -and ($file.Name -match '(?i)(snapshot|ledger|\.jsonl$|\.sqlite|\.db$|^\.env|auth\.json|credentials|\.pdb$|\.tmp$|\.log$)' -or $file.Name -match '(?i)(setup|installer).*\.exe$')) { throw "Refusing to bundle private or installer companion file: $($file.Name)" }
        $skip = $false
        foreach ($pattern in $excluded) { if ($file.Name -like $pattern) { $skip = $true; break } }
        if ($skip) { continue }
        $relative = $file.FullName.Substring($sourceRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
        $target = Join-Path $Destination $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }
    if (-not (Test-Path -LiteralPath (Join-Path $Destination $Executable))) { throw "Companion copy did not produce $Executable" }
}

# One build identity feeds the bundled UI, the native executable and the release manifest.
$packageVersion = (Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot 'package.json') | ConvertFrom-Json).version
if ($packageVersion -ne $Version) { throw "package.json version $packageVersion does not match the requested build version $Version." }
$assemblyInfoSource = Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot 'desktop\AssemblyInfo.cs')
if ($assemblyInfoSource -match 'Assembly(Informational|File)?Version\(') { throw 'desktop\AssemblyInfo.cs must not set version attributes; the build generates them from the build identity.' }
$gitCommit = 'unknown'
$gitDirty = $false
if (Get-Command git -ErrorAction SilentlyContinue) {
    $head = & git -C $ProjectRoot rev-parse --short=12 HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $head) {
        $gitCommit = ([string]($head | Select-Object -First 1)).Trim()
        # The owner's deleted legacy root binaries are excluded; every other tracked change makes the identity dirty.
        $gitDirty = [bool](& git -C $ProjectRoot status --porcelain --untracked-files=no -- . ':(exclude)EZ AI.exe' ':(exclude)EZ AI Launcher.exe' 2>$null)
    }
}
if ($ProfileMode -eq 'Production' -and ($gitCommit -eq 'unknown' -or $gitDirty)) {
    throw 'Production packaging requires a committed, clean source tree so the build identity is accurate. Commit the source changes first.'
}
$buildIdentity = [ordered]@{
    version = $Version
    channel = $ProfileMode.ToLowerInvariant()
    commit = $gitCommit
    dirty = $gitDirty
    buildTimeUtc = [DateTime]::UtcNow.ToString('o')
}
$identityJson = $buildIdentity | ConvertTo-Json -Compress
$env:EZAI_BUILD_IDENTITY = $identityJson
$identityDir = Join-Path ([IO.Path]::GetTempPath()) ('ezai-identity-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $identityDir -Force | Out-Null
$identityFile = Join-Path $identityDir 'BuildIdentity.g.cs'
$informational = "$Version+$($buildIdentity.channel).$gitCommit" + $(if ($gitDirty) { '.dirty' } else { '' })
$numericVersion = $Version -replace '-beta\.', '.'
Set-Content -LiteralPath $identityFile -Encoding ASCII -Value @"
using System.Reflection;

[assembly: AssemblyVersion("$numericVersion")]
[assembly: AssemblyFileVersion("$numericVersion")]
[assembly: AssemblyInformationalVersion("$informational")]

internal static class BuildIdentity
{
    internal const string Version = "$Version";
    internal const string Channel = "$($buildIdentity.channel)";
    internal const string Commit = "$gitCommit";
    internal const bool Dirty = $(if ($gitDirty) { 'true' } else { 'false' });
    internal const string BuildTimeUtc = "$($buildIdentity.buildTimeUtc)";
}
"@

Push-Location $ProjectRoot
try {
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Production UI build failed.' }

    $service = Join-Path $OutputDirectory 'EZ AI Service.exe'
    & $csc /nologo /target:exe /out:$service `
        /reference:"$(Join-Path $framework 'System.dll')" `
        /reference:"$(Join-Path $framework 'System.Core.dll')" `
        /reference:"$(Join-Path $framework 'System.Management.dll')" `
        /reference:"$(Join-Path $framework 'System.Web.Extensions.dll')" `
        /reference:"$(Join-Path $framework 'System.Windows.Forms.dll')" `
        EzAiLauncher.cs HardwareScanService.cs SoftwareDiscoveryService.cs ApplicationActionService.cs InstallerQueueService.cs ModelManagementService.cs InstructionInstallerService.cs EzAiProfilePaths.cs EzAiServiceAssemblyInfo.cs $identityFile
    if ($LASTEXITCODE -ne 0) { throw 'The bundled scanner/service compilation failed.' }

    $webViewLib = Join-Path $webViewPackage 'lib\net462'
    $desktopExe = Join-Path $OutputDirectory 'EZ AI.exe'
    $profileDefine = if ($ProfileMode -eq 'Candidate') { '/define:EZAI_CANDIDATE_PROFILE' } elseif ($ProfileMode -eq 'Development') { '/define:EZAI_DEVELOPMENT_PROFILE' } else { $null }
    $desktopCompilerArgs = @('/nologo', '/target:winexe', "/out:$desktopExe", '/win32icon:ez-ai.ico', '/win32manifest:desktop\EzAi.manifest')
    if ($profileDefine) { $desktopCompilerArgs += $profileDefine }
    $desktopCompilerArgs += @(
        "/reference:$(Join-Path $framework 'System.dll')",
        "/reference:$(Join-Path $framework 'System.Core.dll')",
        "/reference:$windowsBase",
        "/reference:$presentationCore",
        "/reference:$presentationFramework",
        "/reference:$systemXaml",
        "/reference:$(Join-Path $webViewLib 'Microsoft.Web.WebView2.Core.dll')",
        "/reference:$(Join-Path $webViewLib 'Microsoft.Web.WebView2.Wpf.dll')",
        'desktop\DesktopHost.cs', 'desktop\AssemblyInfo.cs', 'EzAiProfilePaths.cs', $identityFile
    )
    & $csc @desktopCompilerArgs
    if ($LASTEXITCODE -ne 0) { throw 'The WPF desktop host compilation failed.' }

    Copy-Item -LiteralPath (Join-Path $webViewLib 'Microsoft.Web.WebView2.Core.dll') -Destination $OutputDirectory -Force
    Copy-Item -LiteralPath (Join-Path $webViewLib 'Microsoft.Web.WebView2.Wpf.dll') -Destination $OutputDirectory -Force
    Copy-Item -LiteralPath (Join-Path $webViewPackage 'runtimes\win-x64\native\WebView2Loader.dll') -Destination $OutputDirectory -Force
    Copy-Item -LiteralPath (Join-Path $webViewPackage 'LICENSE.txt') -Destination (Join-Path $OutputDirectory 'WEBVIEW2-LICENSE.txt') -Force
    Copy-Item -LiteralPath (Join-Path $webViewPackage 'NOTICE.txt') -Destination (Join-Path $OutputDirectory 'WEBVIEW2-NOTICE.txt') -Force
    Copy-Item -LiteralPath 'ez-ai.ico' -Destination $OutputDirectory -Force
    $notices = Join-Path $ProjectRoot 'legal\THIRD_PARTY_LICENSES.txt'
    if (-not (Test-Path -LiteralPath $notices -PathType Leaf)) { throw 'The third-party licence notices file is missing from legal\.' }
    Copy-Item -LiteralPath $notices -Destination (Join-Path $OutputDirectory 'THIRD-PARTY-LICENSES.txt') -Force
    $sourceDist = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'dist')).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $packageDist = [IO.Path]::GetFullPath((Join-Path $OutputDirectory 'dist')).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $outputRoot = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $outputPrefix = $outputRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $packageDist.StartsWith($outputPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to package UI assets outside the requested output directory.'
    }
    if ($packageDist.StartsWith($sourceDist + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        $sourceDist.StartsWith($packageDist + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        [String]::Equals($packageDist, $sourceDist, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The desktop output dist folder must not overlap the project source dist folder.'
    }
    if (Test-Path -LiteralPath $packageDist) {
        $existingDist = Get-Item -LiteralPath $packageDist -Force
        if ($existingDist.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Refusing to replace a reparse-point UI output folder.'
        }
        Remove-Item -LiteralPath $packageDist -Recurse -Force
    }
    New-Item -ItemType Directory -Path $packageDist -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'dist') | Copy-Item -Destination $packageDist -Recurse -Force
    Set-Content -LiteralPath (Join-Path $packageDist 'build-identity.json') -Value $identityJson -Encoding UTF8

    # Companion applications ship inside EZ AI's installed folder so users never locate or install them separately.
    if ($ProfileMode -eq 'Production' -and ([String]::IsNullOrWhiteSpace($SdmSource) -or [String]::IsNullOrWhiteSpace($HudSource))) {
        throw 'Production packaging requires -SdmSource (Aerus SDM distribution folder) and -HudSource (Aerus AI Usage HUD distribution folder).'
    }
    if (-not [String]::IsNullOrWhiteSpace($SdmSource)) {
        Copy-EzAiCompanion -Source $SdmSource -Destination (Join-Path $OutputDirectory 'Companions\Aerus SDM') -Executable 'Aerus SDM.exe' -Product 'Aerus SDM' -Company 'Aeru Studio' -Required @('Aerus SDM.exe', 'resources.pak', 'LICENSE')
    }
    if (-not [String]::IsNullOrWhiteSpace($HudSource)) {
        Copy-EzAiCompanion -Source $HudSource -Destination (Join-Path $OutputDirectory 'Companions\Aerus AI Usage HUD') -Executable 'Aerus AI Usage HUD.exe' -Product 'Aerus AI Usage HUD' -Company 'Aerus Creations' -Required @('Aerus AI Usage HUD.exe', 'Aerus AI Usage HUD.dll', 'Aerus AI Usage HUD.deps.json', 'Aerus AI Usage HUD.runtimeconfig.json', 'hostfxr.dll', 'hostpolicy.dll', 'coreclr.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll', 'server.js', 'runtime\node.exe', 'public\index.html', 'assets\aerus-usage-hud.ico')
    }

    $legacyLauncher = Join-Path $OutputDirectory 'EZ AI Launcher.exe'
    if (Test-Path -LiteralPath $legacyLauncher) {
        throw "The output directory contains the obsolete browser launcher: $legacyLauncher. It is not part of the supported native package. After native acceptance, remove it only with owner approval."
    }

    if ($UpdateDesktopShortcut) {
        if (![String]::Equals($OutputDirectory, $officialRelease, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Desktop shortcut updates are allowed only when packaging the official project release directory.'
        }
        if (!(Test-Path -LiteralPath $ShortcutPath)) { throw "The approved Desktop shortcut must already exist: $ShortcutPath" }
        $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($ShortcutPath)
        $shortcut.TargetPath = $desktopExe
        $shortcut.WorkingDirectory = $OutputDirectory
        $shortcut.Arguments = ''
        $shortcut.IconLocation = "$desktopExe,0"
        $shortcut.Description = 'EZ AI Windows desktop application'
        $shortcut.Save()
        if (![String]::Equals([IO.Path]::GetFullPath($shortcut.TargetPath), [IO.Path]::GetFullPath($desktopExe), [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The Desktop shortcut did not retain the official native executable target.'
        }
        if ($shortcut.Arguments) { throw 'The Desktop shortcut unexpectedly has launch arguments.' }
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EzAiShellRefresh { [DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern void SHChangeNotify(uint eventId, uint flags, string path, IntPtr item2); }
'@
        [EzAiShellRefresh]::SHChangeNotify(0x00002000, 0x0005, $ShortcutPath, [IntPtr]::Zero)
    }
    & (Join-Path $PSScriptRoot 'New-EzAiReleaseManifest.ps1') -ReleaseDirectory $OutputDirectory -Version $Version
    if ($LASTEXITCODE -ne 0) { throw 'Release manifest generation failed.' }
    Write-Output "Desktop package built at $OutputDirectory"
}
finally {
    Pop-Location
    Remove-Item -LiteralPath $identityDir -Recurse -Force -ErrorAction SilentlyContinue
}
