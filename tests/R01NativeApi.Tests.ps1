param([string]$BaseUrl='http://127.0.0.1:62364')
$ErrorActionPreference='Stop'
function Assert-True([bool]$value,[string]$name){if(!$value){throw "FAIL: $name"};Write-Output "PASS: $name"}
function Status([string]$path,$body,[string]$origin=$BaseUrl){try{Invoke-WebRequest -Uri ($BaseUrl+$path) -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body ($body|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 20|Out-Null;return 200}catch{if($_.Exception.Response){return [int]$_.Exception.Response.StatusCode};throw}}
$native=Join-Path $env:USERPROFILE '.local\bin\claude.exe'
Assert-True ((Status '/api/apps/verify-target' @{appId='claude-code';target=$native} 'https://untrusted.invalid') -eq 403) 'selected target verification rejects foreign origins'
Assert-True ((Status '/api/apps/verify-target' @{appId='unknown';target=$native}) -eq 400) 'arbitrary product cannot acquire a trusted target'
Assert-True ((Status '/api/apps/verify-target' @{appId='claude-code';target='C:\Windows\System32\cmd.exe'}) -eq 409) 'a shell cannot impersonate Claude Code'
if(Test-Path -LiteralPath $native){
 $verified=Invoke-RestMethod -Uri ($BaseUrl+'/api/apps/verify-target') -Method Post -Headers @{Origin=$BaseUrl} -ContentType 'application/json' -Body (@{appId='claude-code';target=$native}|ConvertTo-Json -Compress) -TimeoutSec 20
 Assert-True ($verified.success -and $verified.status -eq 'launchable' -and !$verified.processId) 'actual Claude Code identity verifies without starting a session'
 Assert-True ((Status '/api/apps/verify-target' @{appId='claude-desktop';target=$native}) -eq 409) 'Claude Code cannot become a Claude Desktop launch target'
}
$request=@{agentId='claude-code';modelId='';workspace='.';profile='manual';approved=$false;providerMode='normal'}
Assert-True ((Status '/api/agents/launch' $request) -eq 409) 'normal provider mode requires approval'
$request.approved=$true
Assert-True ((Status '/api/agents/launch' $request) -eq 409) 'relative project folder cannot launch an agent'
$request.profile='yolo'
Assert-True ((Status '/api/agents/launch' $request) -eq 400) 'unsupported unrestricted profile is rejected'
$request.profile='manual';$request.providerMode='ollama';$request.modelId='example:cloud'
Assert-True ((Status '/api/agents/launch' $request) -eq 409) 'explicitly local mode rejects cloud model tags'
$request.arguments='--dangerously-skip-permissions'
Assert-True ((Status '/api/agents/launch' $request) -eq 400) 'caller cannot add arbitrary CLI arguments'
Write-Output 'R01 native service checks passed. No CLI session, model generation, installer or download was started.'
