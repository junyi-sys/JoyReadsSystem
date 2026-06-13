@echo off
cd /d "%~dp0..\frontend"
echo ========================================
echo  俊宜阅读 - 一键启动
echo  前端: http://localhost:3002
echo  后端: http://localhost:8002 (自动启动)
echo ========================================
if not exist node_modules (
  echo [ERROR] node_modules not found. Run: npm install
  pause
  exit /b 1
)
call npm run dev
pause
