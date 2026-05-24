#!/bin/bash
# 正式环境一键启动（端口：前端 :3001，后端 :8001）
echo "=== 正式环境启动 ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 启动后端
(cd "$ROOT_DIR/backend" && source .venv/Scripts/activate && APP_ENV=production python run.py) &

# 启动前端（production 模式 Vite dev server，含 proxy）
(cd "$ROOT_DIR/frontend" && npm run dev:prod) &

echo "正式环境已启动: 前端 http://localhost:3001 | 后端 http://localhost:8001"
wait
