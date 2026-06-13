@echo off
set PATH=D:\Program Files\nodejs;%PATH%
echo ========================================
echo  俊宜阅读 - 一键启动
echo  前端: http://localhost:3002
echo  后端: http://localhost:8002 (自动启动)
echo ========================================
cd /d I:\python\study\pypro2605\JoyReadsSystem\frontend
call npm run dev
pause
