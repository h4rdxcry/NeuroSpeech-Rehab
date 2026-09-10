# NeuroSpeech Rehab Full-Stack Launcher (PowerShell)
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  NeuroSpeech Rehab - Unified Full-Stack Platform " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$RootPath = $PSScriptRoot
$BackendDir = Join-Path $RootPath "backend"
$FrontendDir = Join-Path $RootPath "frontend"
$PythonExe = Join-Path $BackendDir ".venv-ml\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
}
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$BackendProcess = Start-Process -FilePath powershell -ArgumentList "-NoExit", "-Command", "cd '$RootPath'; `$env:PYTHONPATH='$RootPath;$BackendDir'; & '$PythonExe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

Write-Host "[2/2] Starting Vite Frontend on http://localhost:3000..." -ForegroundColor Green
$FrontendProcess = Start-Process -FilePath powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev" -PassThru

Write-Host ""
Write-Host "Application is launching!" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
