$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
function Assert-True([bool]$condition, [string]$message) { if (-not $condition) { throw "FAIL: $message" }; Write-Host "PASS: $message" }
$hostSource = Get-Content -Raw -LiteralPath (Join-Path $root 'desktop\DesktopHost.cs')
$profiles = Get-Content -Raw -LiteralPath (Join-Path $root 'EzAiProfilePaths.cs')
$build = Get-Content -Raw -LiteralPath (Join-Path $root 'tools\Build-EzAiDesktop.ps1')
$actions = Get-Content -Raw -LiteralPath (Join-Path $root 'ApplicationActionService.cs')
$instructions = Get-Content -Raw -LiteralPath (Join-Path $root 'InstructionInstallerService.cs')
Assert-True ($hostSource.Contains('Local\EZAI.Desktop.SingleInstance') -and $hostSource.Contains('ProfileMode') -and $hostSource.Contains('DataRoot')) 'production mutex and local-app-data path remain stable while isolated modes are explicit'
Assert-True ($hostSource.Contains('CoreWebView2Environment.CreateAsync(null, webProfile, null)') -and $hostSource.Contains('info.EnvironmentVariables["EZ_AI_DATA_ROOT"]')) 'WebView2 and owned local service use the selected native profile'
Assert-True ($build.Contains('ProfileMode') -and $build.Contains('EZAI_CANDIDATE_PROFILE') -and $build.Contains('EZAI_DEVELOPMENT_PROFILE') -and $build.Contains('outside the production release directory')) 'build tool offers isolated candidate/development modes and protects release output'
Assert-True ($profiles.Contains('Environment.SpecialFolder.LocalApplicationData') -and $profiles.Contains('StableId') -and $profiles.Contains('Candidates') -and $profiles.Contains('Development')) 'profile paths derive from Windows Local AppData and stable candidate IDs'
Assert-True ($actions.Contains('RegistryHive.CurrentUser') -and $actions.Contains('RegistryHive.LocalMachine') -and $actions.Contains('RegistryView.Registry64') -and $actions.Contains('RegistryView.Registry32')) 'companion discovery checks registered user and machine installers read-only across both registry views'
Assert-True (-not $actions.Contains('C:\AI-services\Aerus-SDM')) 'companion runtime source no longer contains the developer-specific SDM path'
Assert-True ($instructions.Contains('CODEX_HOME') -and $instructions.Contains('CLAUDE_CONFIG_DIR') -and $instructions.Contains('explicitly configured CODEX_HOME directory to exist')) 'global instruction paths use the current profile and documented overrides'
Assert-True ($hostSource.Contains('ActivateExistingWindow(WindowTitle)') -and $hostSource.Contains('Title = Program.WindowTitle') -and $hostSource.Contains('Candidate ') -and $hostSource.Contains('Development')) 'candidate and development relaunches focus their own native window rather than production'
Write-Host 'Portability source checks passed.'
