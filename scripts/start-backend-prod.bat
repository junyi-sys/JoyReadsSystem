@echo off
cd /d I:\python\study\pypro2605\JoyReadsSystem\backend
set APP_ENV=production

:loop
echo [%date% %time%] Starting backend...
.venv\Scripts\python.exe run.py
echo [%date% %time%] Backend stopped (exit code: %ERRORLEVEL%), restarting in 3s...
timeout /t 3 /nobreak >nul
goto loop
