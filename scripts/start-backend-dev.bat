@echo off
cd /d I:\python\study\pypro2605\JoyReadsSystem\backend
set APP_ENV=development

:loop
echo [%date% %time%] Starting dev backend...
.venv\Scripts\python.exe run.py
echo [%date% %time%] Dev backend stopped, restarting in 3s...
timeout /t 3 /nobreak >nul
goto loop
