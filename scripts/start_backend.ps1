@echo "Starting backend using venv311 uvicorn on port 8002"
Set-Location -Path "${PSScriptRoot}\..\backend"
if (Test-Path .\venv311\Scripts\Activate.ps1) {
    .\venv311\Scripts\Activate.ps1
}

Write-Host "Running: .\venv311\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8002"
.\venv311\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8002
