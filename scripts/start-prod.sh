#!/bin/bash
# 正式环境一键启动（端口：前端 :3001，后端 :8001）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 确保 Node.js 在 PATH 中（Windows Git Bash 可能找不到）
export PATH="/d/Program Files/nodejs:$PATH"

# 加载正式环境配置（source 到当前 shell，环境变量被子进程继承）
export APP_ENV=production
set -a
if [ -f "$ROOT_DIR/backend/.env.production" ]; then
    source "$ROOT_DIR/backend/.env.production"
fi
if [ -f "$ROOT_DIR/backend/.env" ]; then
    source "$ROOT_DIR/backend/.env"
fi
set +a

# 环境自检
bash "$SCRIPT_DIR/check-env.sh" production

# 启动后端（APP_ENV 从当前 shell 继承到 Python 进程）
echo "[start] 启动后端..."
cd "$ROOT_DIR/backend"
.venv/Scripts/python run.py &
BEPID=$!
echo "[start] 后端 PID=$BEPID"

# 等待后端就绪
for i in 1 2 3 4 5; do
    sleep 1
    if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
        echo "[start] 后端就绪"
        break
    fi
    echo "[start] 等待后端... ($i)"
done

# 启动前端
echo "[start] 启动前端..."
cd "$ROOT_DIR/frontend"
npm run dev:prod &
FEPID=$!

echo "正式环境已启动: 前端 http://localhost:3001 | 后端 http://localhost:8001"
echo "进程: 前端=$FEPID 后端=$BEPID"

# 处理退出信号，确保子进程被清理
cleanup() {
    echo "[start] 正在关闭..."
    kill $BEPID 2>/dev/null
    kill $FEPID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# 保持脚本运行
wait $FEPID
