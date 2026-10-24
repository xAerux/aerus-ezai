param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ReleaseDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release'),
    [switch]$SkipShortcutCheck
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ReleaseDirectory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
function Assert-True([bool]$condition,[string]$message) { if (!$condition) { throw "FAIL: $message" }; Write-Host "PASS: $message" }

$hostPath = Join-Path $ReleaseDirectory 'EZ AI.exe'
$servicePath = Join-Path $ReleaseDirectory 'EZ AI Service.exe'
$iconPath = Join-Path $ReleaseDirectory 'ez-ai.ico'
$uiPath = Join-Path $ReleaseDirectory 'dist\index.html'
foreach ($required in @($hostPath,$servicePath,$iconPath,$uiPath)) { Assert-True (Test-Path -LiteralPath $required) "packaged component exists: $([IO.Path]::GetFileName($required))" }

function Read-PeSubsystem([string]$path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $peOffset = [BitConverter]::ToInt32($bytes,0x3c)
    return [BitConverter]::ToUInt16($bytes,$peOffset+24+68)
}
$hostInfo = (Get-Item -LiteralPath $hostPath).VersionInfo
Assert-True ($hostInfo.ProductName -eq 'EZ AI' -and $hostInfo.CompanyName -eq 'EZ AI') 'WPF executable has EZ AI product identity'
Assert-True ((Read-PeSubsystem $hostPath) -eq 2) 'official WPF host is a Windows GUI executable, not a console executable'
Assert-True ((Read-PeSubsystem $servicePath) -eq 3) 'background service is a console-subsystem process launched hidden by WPF'
Assert-True (!(Test-Path -LiteralPath (Join-Path $ReleaseDirectory 'EZ AI Launcher.exe'))) 'legacy browser launcher is excluded from the production release'

$icon = [IO.File]::ReadAllBytes($iconPath)
$count = [BitConverter]::ToUInt16($icon,4)
Assert-True ($icon.Length -gt 22 -and $count -eq 7) 'approved ICO has seven image frames'
$dimensions = New-Object 'System.Collections.Generic.HashSet[int]'
for ($i=0; $i -lt $count; $i++) {
    $entry = 6 + 16*$i
    $width = [int]$icon[$entry]; if ($width -eq 0) { $width = 256 }
    $height = [int]$icon[$entry+1]; if ($height -eq 0) { $height = 256 }
    $length = [BitConverter]::ToUInt32($icon,$entry+8)
    $offset = [BitConverter]::ToUInt32($icon,$entry+12)
    Assert-True ($width -eq $height -and $length -gt 0 -and $offset+$length -le $icon.Length) "valid $width x $height icon frame"
    [void]$dimensions.Add($width)
}
Assert-True ((@($dimensions | Sort-Object) -join ',') -eq '16,24,32,48,64,128,256') 'approved shield/A icon contains the expected multiresolution sizes'
Add-Type -AssemblyName System.Drawing
$embeddedIcon = [Drawing.Icon]::ExtractAssociatedIcon($hostPath)
Assert-True ($null -ne $embeddedIcon -and $embeddedIcon.ToBitmap().Width -gt 0) 'Windows can extract an icon resource from the compiled EZ AI executable'

$hostSource = Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot 'desktop\DesktopHost.cs')
$loadedStart = $hostSource.IndexOf('private async void OnLoaded')
$serviceStart = $hostSource.IndexOf('private async Task StartService')
$loadedBody = $hostSource.Substring($loadedStart,$serviceStart-$loadedStart)
$externalStart = $hostSource.IndexOf('private void OnNewWindowRequested')
$closingStart = $hostSource.IndexOf('private async void OnClosing')
$externalBody = $hostSource.Substring($externalStart,$closingStart-$externalStart)
Assert-True ($hostSource.Contains('[STAThread]') -and $hostSource.Contains('webView.EnsureCoreWebView2Async')) 'WPF starts the embedded WebView2 host on its STA UI thread'
Assert-True (!$loadedBody.Contains('Process.Start') -and !$loadedBody.Contains('UseShellExecute = true')) 'application startup does not launch a browser process'
Assert-True ($externalBody.Contains('e.Handled = true') -and $externalBody.Contains('Uri.UriSchemeHttps') -and $externalBody.Contains('Process.Start')) 'only user-requested HTTPS new-window navigation is handed to the system browser'
Assert-True ($hostSource.Contains('UseShellExecute = false') -and $hostSource.Contains('CreateNoWindow = true') -and $hostSource.Contains('--no-browser')) 'WPF starts the local service without a visible console or browser fallback'
Assert-True ($hostSource.Contains('Arguments = "--port=0 --no-browser"') -and $hostSource.Contains('BeginOutputReadLine()') -and $hostSource.Contains('servicePort = selectedPort')) 'WPF obtains the local service port from the child service instead of reserving a fixed port'
Assert-True (!$hostSource.Contains('ServicePort = 62364') -and $hostSource.Contains('GetAvailableBrowserVersionString(null)')) 'host avoids the previous fixed port and checks WebView2 Runtime availability before service startup'
Assert-True ($hostSource.Contains('Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ez-ai.ico")')) 'WPF window and taskbar icon load the packaged approved ICO'
Assert-True ($hostSource.Contains('SetForegroundWindow(window)') -and $hostSource.Contains('ShowWindow(window, 9)')) 'repeat launch restores and focuses the existing EZ AI window'
$buildSource = Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot 'tools\Build-EzAiDesktop.ps1')
Assert-True ($buildSource.Contains('/target:winexe') -and $buildSource.Contains('/win32icon:ez-ai.ico')) 'production build embeds the approved icon into the GUI executable'

if (!$SkipShortcutCheck) {
    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EZ AI.lnk'
    Assert-True (Test-Path -LiteralPath $shortcutPath) 'approved user Desktop shortcut exists'
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
    Assert-True ([IO.Path]::GetFullPath($shortcut.TargetPath) -eq [IO.Path]::GetFullPath($hostPath)) 'Desktop shortcut targets the production WPF executable'
    Assert-True ([IO.Path]::GetFullPath($shortcut.WorkingDirectory) -eq $ReleaseDirectory) 'Desktop shortcut uses the production release working directory'
    Assert-True ([String]::IsNullOrEmpty($shortcut.Arguments)) 'Desktop shortcut has no browser-preview or console arguments'
    Assert-True ($shortcut.IconLocation -like '*EZ AI.exe,0') 'Desktop shortcut uses the icon embedded in EZ AI.exe'
}

Write-Host 'Desktop launcher integrity checks passed. Native window interaction is a separate manual acceptance check.'
