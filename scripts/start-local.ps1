param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot 'work/local-runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$pythonExe = Join-Path $projectRoot 'backend/.venv-ml/Scripts/python.exe'
$viteScript = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
if (!(Test-Path -LiteralPath $pythonExe) -or !(Test-Path -LiteralPath $viteScript)) {
    throw 'Install the backend and frontend dependencies described in README.md first.'
}
docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    docker desktop start | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop could not start.' }
}
docker start neurospeech-stitch-verification | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The preserved local database container is unavailable. Follow the database recovery instructions in README.md.' }
$dbReady = $false
for ($i = 0; $i -lt 20; $i++) {
    docker exec neurospeech-stitch-verification pg_isready -U verification -d neurospeech_stitch *> $null
    if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
    Start-Sleep -Seconds 1
}
if (!$dbReady) { throw 'Local PostgreSQL did not become ready.' }
$env:DATABASE_URL = 'postgresql+asyncpg://verification:verification_test_only@127.0.0.1:55432/neurospeech_stitch'
$env:ENVIRONMENT = 'development'
$env:CORS_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174'
$env:HF_HUB_OFFLINE = '1'
$env:VITE_API_URL = 'http://127.0.0.1:8000'
$env:NEUROSPEECH_RECORDING_ROOT = Join-Path $runtimeDir 'recordings'
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $pythonExe -m alembic current
    if ($LASTEXITCODE -ne 0) { throw 'Database migration check failed.' }
    & $pythonExe (Join-Path $projectRoot 'scripts/setup_local_access.py')
    if ($LASTEXITCODE -ne 0) { throw 'Local access setup failed.' }
} finally { Pop-Location }
$started = @()
foreach ($service in @(
    @{ Name='backend'; Port=8000; File=$pythonExe; Arguments=@('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--no-access-log','--log-level','warning'); Directory=(Join-Path $projectRoot 'backend') },
    @{ Name='frontend'; Port=5174; File=(Get-Command node).Source; Arguments=@($viteScript,'--host','127.0.0.1','--port','5174','--strictPort'); Directory=(Join-Path $projectRoot 'frontend') }
)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($existing.ParentProcessId)" -ErrorAction SilentlyContinue
        $isOurs = if ($service.Name -eq 'backend') { ($existing.ExecutablePath -eq $pythonExe -or $parent.ExecutablePath -eq $pythonExe) -and $existing.CommandLine -match 'app.main:app' } else { $existing.CommandLine -like "*$viteScript*" -or $existing.CommandLine -like "*$projectRoot*frontend*vite*" }
        if (!$isOurs) { throw "Port $($service.Port) is used by another process. No process was stopped." }
        $started += @{ service=$service.Name; pid=$listener.OwningProcess; reused=$true }
    } else {
        $process = Start-Process -FilePath $service.File -ArgumentList $service.Arguments -WorkingDirectory $service.Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir ($service.Name+'.log')) -RedirectStandardError (Join-Path $runtimeDir ($service.Name+'.error.log')) -PassThru
        $started += @{ service=$service.Name; pid=$process.Id; reused=$false }
    }
}
$started | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'processes.json')
foreach ($url in @('http://127.0.0.1:8000/health','http://127.0.0.1:5174/login')) {
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        try { $response = Invoke-WebRequest -Uri $url -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready=$true; break } } catch {}
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw "Service did not become ready: $url. See work/local-runtime logs." }
}
Write-Output 'Website: http://127.0.0.1:5174/login'
Write-Output 'API: http://127.0.0.1:8000/docs'
Write-Output 'Local practice login: patient@neurospeech.dev / NeuroSpeechDemo123!'
