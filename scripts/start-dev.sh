#!/bin/bash
# 开发环境一键启动（端口：前端 :3002，后端 :8002）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 确保 Node.js 在 PATH 中（Windows Git Bash 可能找不到）
export PATH="/d/Program Files/nodejs:$PATH"

# 加载开发环境配置
export APP_ENV=development
set -a
if [ -f "$ROOT_DIR/backend/.env.development" ]; then
    source "$ROOT_DIR/backend/.env.development"
fi
if [ -f "$ROOT_DIR/backend/.env" ]; then
    source "$ROOT_DIR/backend/.env"
fi
set +a

# 环境自检
bash "$SCRIPT_DIR/check-env.sh" development

# 启动后端
echo "[start] 启动后端..."
cd "$ROOT_DIR/backend"
.venv/Scripts/python run.py &
BEPID=$!

# 等待后端就绪
for i in 1 2 3 4 5; do
    sleep 1
    if curl -s http://localhost:8002/api/health > /dev/null 2>&1; then
        echo "[start] 后端就绪"
        break
    fi
    echo "[start] 等待后端... ($i)"
done

# 启动前端
echo "[start] 启动前端..."
cd "$ROOT_DIR/frontend"
npm run dev &
FEPID=$!

echo "开发环境已启动: 前端 http://localhost:3002 | 后端 http://localhost:8002"

cleanup() {
    echo "[start] 正在关闭..."
    kill $BEPID 2>/dev/null
    kill $FEPID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait $FEPID
