# start_all.ps1
# This script starts all services for the Smart Attendance project.
# Run this script from the 'smart-attendance' directory.

# 1. Start MongoDB Service
Write-Host "Attempting to start MongoDB service..."
try {
    Start-Service -Name "MongoDB" -ErrorAction Stop
    Write-Host "✅ MongoDB service started successfully."
} catch {
    Write-Warning "⚠️ Could not start MongoDB service. Please ensure it is installed and run 'mongod' manually in a separate terminal."
}

# 2. Start Backend Server
Write-Host "Starting backend server in a new window..."
$backendCommand = {
    cd backend;
    .\venv311\Scripts\Activate.ps1;
    .\venv311\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8002;
    Read-Host -Prompt "Backend server has stopped. Press Enter to exit."
}
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", '$backendCommand'

# 3. Start Frontend Server
Write-Host "Starting frontend server in a new window..."
$frontendCommand = {
    cd frontend;
    npm install;
    npm start;
    Read-Host -Prompt "Frontend server has stopped. Press Enter to exit."
}
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", '$frontendCommand'

Write-Host "🚀 All services are starting up in new windows."
Write-Host "Please check the new windows for status and logs."
