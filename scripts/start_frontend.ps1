@echo "Starting frontend (Expo/web)"
Set-Location -Path "${PSScriptRoot}\..\frontend"
if (Test-Path package.json) {
    npm install
    npm start
} else {
    Write-Host "frontend package.json not found"
}
