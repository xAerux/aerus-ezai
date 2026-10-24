param([string]$BaseUrl = 'http://127.0.0.1:62365')
$ErrorActionPreference = 'Stop'
$origin = ([Uri]$BaseUrl).GetLeftPart([UriPartial]::Authority)
$base = $BaseUrl.TrimEnd('/') + '/api/installers/'
function Assert-True([bool]$ok,[string]$label){if(-not $ok){throw "FAIL: $label"};Write-Host "PASS: $label"}
function Status($Action){try{& $Action|Out-Null;200}catch{if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{throw}}}
$unknown=@{installerId='unlisted'}|ConvertTo-Json -Compress
$status=Status {Invoke-WebRequest -Uri ($base+'download') -Method Post -Headers @{Origin='https://attacker.invalid'} -ContentType 'application/json' -Body $unknown -UseBasicParsing -TimeoutSec 10}
Assert-True ($status -eq 403) 'blocks cross-origin download starts'
$status=Status {Invoke-WebRequest -Uri ($base+'download') -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{installerId='unlisted'}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10}
Assert-True ($status -eq 400) 'rejects unregistered installer ids without network access'
$status=Status {Invoke-WebRequest -Uri ($base+'download') -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{installerId='cursor';url='https://evil.example/setup.exe'}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10}
Assert-True ($status -eq 400) 'rejects caller-supplied URLs'
$status=Status {Invoke-WebRequest -Uri ($base+'cancel') -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{jobId='not-a-job'}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10}
Assert-True ($status -eq 404) 'returns a useful missing-job response for cancellation'
$status=Status {Invoke-WebRequest -Uri ($base+'execute') -Method Post -Headers @{Origin=$origin} -ContentType 'application/json' -Body (@{jobId='not-a-job';approved=$true}|ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 10}
Assert-True ($status -eq 404) 'does not execute a missing or unverified installer job'
$jobs=Invoke-RestMethod -Uri ($base+'jobs') -Method Get -TimeoutSec 10
Assert-True ($jobs.Count -eq 0) 'does not create phantom queue items in the absence of a download'
Write-Host 'Installer action API checks passed. No download or installer was started.'
