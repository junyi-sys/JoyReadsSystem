@echo off
cd /d I:\python\study\pypro2605\JoyReadsSystem\backend
call .venv\Scripts\activate.bat
set APP_ENV=production
echo ========================================
echo  俊宜阅读 Backend (port 8002)
echo ========================================
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
pause
