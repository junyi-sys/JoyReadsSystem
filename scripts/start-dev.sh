#!/bin/bash
# 开发环境一键启动（端口：前端 :3002，后端 :8002）
echo "=== 开发环境启动 ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 启动后端
(cd "$ROOT_DIR/backend" && source .venv/Scripts/activate && APP_ENV=development python run.py) &

# 启动前端
(cd "$ROOT_DIR/frontend" && npm run dev) &

echo "开发环境已启动: 前端 http://localhost:3002 | 后端 http://localhost:8002"
wait
