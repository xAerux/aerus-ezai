$ErrorActionPreference = 'Stop'
$servicePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'release\EZ AI Service.exe'
if (!(Test-Path -LiteralPath $servicePath)) { throw 'Build the packaged service before running the ephemeral-port check.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ez-ai-port-test-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
$processes = @()
try {
    $ports = @()
    for ($i = 0; $i -lt 2; $i++) {
        $stdout = Join-Path $temp ("service-$i.out")
        $stderr = Join-Path $temp ("service-$i.err")
        $process = Start-Process -FilePath $servicePath -ArgumentList '--port=0 --no-browser' -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $processes += $process
        $deadline = [DateTime]::UtcNow.AddSeconds(12)
        $port = 0
        while ([DateTime]::UtcNow -lt $deadline -and !$process.HasExited -and !$port) {
            if (Test-Path -LiteralPath $stdout) {
                $text = Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue
                if ($null -ne $text) {
                    $match = [regex]::Match($text, '(?m)^EZ AI is running at http://127\.0\.0\.1:(\d+)/?\r?$')
                    if ($match.Success) { $port = [int]$match.Groups[1].Value }
                }
            }
            Start-Sleep -Milliseconds 100
            $process.Refresh()
        }
        if (!$port) {
            $detail = if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Raw } else { '' }
            throw "Service did not publish an ephemeral loopback port. $detail"
        }
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -ne 200 -or $response.Content -notmatch '<title>EZ AI \| Local AI, Made Easy</title>') { throw "Service on port $port did not return the EZ AI page." }
        $ports += $port
        Write-Host "PASS: isolated service $i selected port $port and served its local UI"
    }
    if ($ports[0] -eq $ports[1]) { throw 'Two concurrent EZ AI services selected the same local port.' }
    Write-Host 'PASS: concurrent local service instances use distinct OS-assigned loopback ports.'
} finally {
    foreach ($process in $processes) {
        try { if (!$process.HasExited) { $process.Kill(); $process.WaitForExit(3000) | Out-Null } } catch { }
        $process.Dispose()
    }
    $safeRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolved = [IO.Path]::GetFullPath($temp)
    if (!$resolved.StartsWith($safeRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary test cleanup path.' }
    if ([IO.Directory]::Exists($resolved)) { [IO.Directory]::Delete($resolved, $true) }
}
