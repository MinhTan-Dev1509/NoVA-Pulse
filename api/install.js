// GET /install.ps1  ->  irm https://<domain>/install.ps1 | iex
const PS = String.raw`$ErrorActionPreference = 'Stop'
$server = '__SERVER__'
$dir = Join-Path $env:LOCALAPPDATA 'NovaPulse'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Write-Host 'NoVA Pulse: dang cai agent...' -ForegroundColor Cyan

$hasPy = $false
try { & python --version *> $null; $hasPy = ($LASTEXITCODE -eq 0) } catch { $hasPy = $false }
if (-not $hasPy) {
  Write-Host 'Chua co Python, dang cai qua winget...'
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine')
}
python -m venv (Join-Path $dir 'venv')
& (Join-Path $dir 'venv\Scripts\pip.exe') install --quiet psutil
$agent = Join-Path $dir 'agent.py'
Invoke-WebRequest -UseBasicParsing "$server/agent.py" -OutFile $agent

$py  = Join-Path $dir 'venv\Scripts\python.exe'
$pyw = Join-Path $dir 'venv\Scripts\pythonw.exe'
$arg = '"{0}" --server {1}' -f $agent, $server
$act = New-ScheduledTaskAction -Execute $pyw -Argument $arg
$trg = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'NovaPulse' -Action $act -Trigger $trg -Settings $set -Force | Out-Null

$pinCmd = ('@"{0}" "{1}" --pin-only --server {2}' -f $py, $agent, $server) + [Environment]::NewLine + '@pause'
Set-Content -Path (Join-Path $dir 'pin.cmd') -Value $pinCmd -Encoding ASCII

Write-Host 'Xong! Nhap ma PIN ben duoi vao app tren dien thoai. Co the thu nho cua so nay; lan dang nhap sau agent tu chay ngam.' -ForegroundColor Green
& $py $agent --server $server --pin
`;
module.exports = (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(PS.replace('__SERVER__', `https://${host}`));
};
