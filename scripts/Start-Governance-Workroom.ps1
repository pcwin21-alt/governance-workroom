$workspacePath = Split-Path -Parent $PSScriptRoot
$port = 4173
$logDirectory = Join-Path $env:TEMP 'governance-workroom'
$stdoutLog = Join-Path $logDirectory 'server.stdout.log'
$stderrLog = Join-Path $logDirectory 'server.stderr.log'

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
    if (-not (Test-Path -LiteralPath $nodePath)) {
        $shell = New-Object -ComObject WScript.Shell
        $shell.Popup('Node.js was not found. Install Node.js and try again.', 0, 'Governance Workroom', 0x10) | Out-Null
        exit 1
    }
    $serverCommand = "cd /d `"$workspacePath`" && `"$nodePath`" server.mjs"
    Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/s', '/c', $serverCommand) -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

    $deadline = (Get-Date).AddSeconds(12)
    do {
        Start-Sleep -Milliseconds 250
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    } until ($listener -or (Get-Date) -ge $deadline)
}

if ($listener) {
    Start-Process "http://localhost:$port"
} else {
    $shell = New-Object -ComObject WScript.Shell
    $shell.Popup("The server did not start. Check: $stderrLog", 0, 'Governance Workroom', 0x10) | Out-Null
}
