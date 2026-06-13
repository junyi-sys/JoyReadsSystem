@echo off
cd /d "%~dp0..\backend"
set APP_ENV=production
echo ========================================
echo  俊宜阅读 Backend (port 8002)
echo ========================================
if not exist .venv\Scripts\python.exe (
  echo [ERROR] venv not found. Run: python -m venv .venv ^&^& .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo.
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8002
pause
