param([string]$BaseUrl = 'http://127.0.0.1:62365')
$ErrorActionPreference = 'Stop'
$origin = ([Uri]$BaseUrl).GetLeftPart([UriPartial]::Authority)
$uri = $BaseUrl.TrimEnd('/') + '/api/apps/launch'
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw "FAIL: $Message"};Write-Host "PASS: $Message"}
function Get-Status($Action){try{& $Action | Out-Null;return 200}catch{if($_.Exception.Response){return [int]$_.Exception.Response.StatusCode};throw}}
$body = @{appId='claude-code'} | ConvertTo-Json -Compress
$status=Get-Status { Invoke-WebRequest -Uri $uri -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 10 }
Assert-True ($status -eq 403) 'blocks cross-origin launch actions'
$status=Get-Status { Invoke-WebRequest -Uri $uri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 10 }
Assert-True ($status -eq 400) 'rejects unsupported CLI launch identifiers without invoking a process'
$unsafe = @{appId='chatgpt';target='C:\Windows\System32\cmd.exe';arguments='/c start powershell'} | ConvertTo-Json -Compress
$status=Get-Status { Invoke-WebRequest -Uri $uri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body $unsafe -UseBasicParsing -TimeoutSec 10 }
Assert-True ($status -eq 400) 'rejects caller-supplied executable targets and arguments'
$workspaceDefaultUri = $BaseUrl.TrimEnd('/') + '/api/agents/workspace/default'
$workspaceForeign = Get-Status { Invoke-WebRequest -Uri $workspaceDefaultUri -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 }
Assert-True ($workspaceForeign -eq 403) 'blocks cross-origin workspace creation and picker requests'
$workspaceDefault = Invoke-RestMethod -Uri $workspaceDefaultUri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body '{}' -TimeoutSec 10
Assert-True ($workspaceDefault.success -and $workspaceDefault.workspace.EndsWith('\EZ AI\Workspaces\Scratch')) 'returns the application-owned per-user Scratch workspace'
$workspaceValidateUri = $BaseUrl.TrimEnd('/') + '/api/agents/workspace/validate'
$workspaceValid = Invoke-RestMethod -Uri $workspaceValidateUri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{path=$workspaceDefault.workspace}|ConvertTo-Json -Compress) -TimeoutSec 10
Assert-True ($workspaceValid.success -and $workspaceValid.workspace -eq $workspaceDefault.workspace) 'validates and canonicalizes the exact reviewed workspace'
$workspaceInvalid = Get-Status { Invoke-WebRequest -Uri $workspaceValidateUri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{path='C:\EZ-AI-nonexistent-workspace'}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 }
Assert-True ($workspaceInvalid -eq 409) 'rejects missing workspace folders before opening launch approval'
Write-Host 'Application action API checks passed. No installed application was launched.'
$agentLaunch = $BaseUrl.TrimEnd('/') + '/api/agents/launch-ollama'
$invalidOrigin = Get-Status { Invoke-WebRequest -Uri $agentLaunch -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body (@{agentId='opencode';workspace='C:\AI\demo';approved=$true}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 }
Assert-True ($invalidOrigin -eq 403) 'blocks cross-origin Ollama integration launches'
$unapproved = Get-Status { Invoke-WebRequest -Uri $agentLaunch -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{agentId='opencode';workspace='C:\AI\demo';approved=$false}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 }
Assert-True ($unapproved -eq 409) 'Ollama integration route requires explicit approval'
$unknownIntegration = Get-Status { Invoke-WebRequest -Uri $agentLaunch -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{agentId='cmd.exe';workspace='C:\AI\demo';approved=$true}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 }
Assert-True ($unknownIntegration -eq 400) 'Ollama integration API rejects unallowlisted command names'
$badWorkspace = Get-Status { Invoke-WebRequest -Uri $agentLaunch -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{agentId='opencode';workspace='.';approved=$true}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10 }
Assert-True ($badWorkspace -eq 409) 'Ollama integration API rejects a relative workspace before launch'
$monitorStatusUri = $BaseUrl.TrimEnd('/') + '/api/companions/aerus-usage-hud/status'
$monitorForeign = Get-Status { Invoke-WebRequest -Uri $monitorStatusUri -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 }
Assert-True ($monitorForeign -eq 403) 'blocks cross-origin HUD discovery'
$monitorStatus = Get-Status { Invoke-WebRequest -Uri $monitorStatusUri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 }
Assert-True ($monitorStatus -eq 200 -or $monitorStatus -eq 404) 'HUD status check is read-only and reports availability without starting it'
$sdmStatusUri = $BaseUrl.TrimEnd('/') + '/api/companions/aerus-sdm/status'
$sdmForeign = Get-Status { Invoke-WebRequest -Uri $sdmStatusUri -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 }
Assert-True ($sdmForeign -eq 403) 'blocks cross-origin Aerus SDM discovery'
$sdmStatus = Get-Status { Invoke-WebRequest -Uri $sdmStatusUri -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 }
Assert-True ($sdmStatus -eq 200 -or $sdmStatus -eq 404) 'Aerus SDM status check is read-only and reports a verified local target without launching it'
Write-Host 'Ollama, monitor, and Aerus SDM API checks passed. No agent, monitor, SDM app, model, installer or browser was started.'
