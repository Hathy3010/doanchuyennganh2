# Local Setup — Smart Attendance

This file documents the exact steps to start MongoDB, the backend, and the frontend on a Windows development machine (project root: `smart-attendance`).

Prerequisites
- Python 3.11
- Node.js and npm
- MongoDB (server `mongod`) installed and available on `localhost:27017`
- Git (repo already cloned)

1) Start MongoDB

If MongoDB is installed as a Windows service:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

Or run `mongod` directly (adjust `--dbpath`):

```powershell
# Run in a dedicated terminal
mongod --dbpath "C:\path\to\mongodb\data"
```

2) Backend (Python)

Open PowerShell in `smart-attendance/backend` and activate the venv, then start uvicorn:

```powershell
Set-Location C:\Users\OS\Abc\smart-attendance\backend
# Use the project's venv
.\venv311\Scripts\Activate.ps1
# (optional) Reinstall requirements if you changed them
pip install -r requirements.txt
# Start backend without reload for stability
.\venv311\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8002
```

Notes:
- If you prefer port 8001, change `--port 8001` and update `frontend/config/api.ts` accordingly.
- Avoid `--reload` when running for extended testing; it can spawn watcher subprocesses which complicate process management.

3) Frontend (web / Expo)

Open a separate terminal in `smart-attendance/frontend`:

```bash
cd C:\Users\OS\Abc\smart-attendance\frontend
npm install
npm start
```

4) Seed test data (optional)

Use the backend `seed_data.py` to create example users/classes (will use MongoDB configured in code):

```powershell
# From backend folder
.\venv311\Scripts\Activate.ps1
python seed_data.py
```

5) Quick API tests

Health:

```powershell
curl http://localhost:8002/health
```

Detect action (replace `<BASE64_IMAGE>` with actual base64):

```powershell
curl http://localhost:8002/detect-face-pose-and-expression -H "Content-Type: application/json" -d "{\"image\":\"<BASE64_IMAGE>\",\"current_action\":\"blink\"}"
```

Student dashboard (requires auth token):

```powershell
curl http://localhost:8002/student/dashboard -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Troubleshooting
- If `uvicorn` reports port in use: find existing processes and stop them, or choose a different port.
- If Pydantic warnings appear about `schema_extra` or other v2 keys, they are warnings — code has been adjusted for v2 compatibility.
- If the server starts then immediately stops: try running `uvicorn` without `--reload` and watch logs in the same terminal.

If you want, I can add a simple `start_all.ps1` helper that starts Mongo (if installed locally), the backend, and the frontend using new terminals.
