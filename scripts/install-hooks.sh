#!/bin/bash
# 安装 Git hooks — 提交前自动验证环境、import、TypeScript、分支规范
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$ROOT_DIR/.git/hooks"

cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
ROOT_DIR="$(git rev-parse --show-toplevel)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "master" ]; then
    # 禁止在 master 直接开发
    if [ ! -f "$ROOT_DIR/.git/MERGE_HEAD" ]; then
        echo "============================================"
        echo " ERROR: 禁止在 master 直接开发！"
        echo " 请切到 feature-dev 开发，完成后 merge。"
        echo "============================================"
        exit 1
    fi
    MODE=production
elif [ "$BRANCH" = "feature-dev" ]; then
    MODE=development
else
    echo "ERROR: 禁止在非 master/feature-dev 分支提交！"
    exit 1
fi

# 1. 环境配置
bash "$ROOT_DIR/scripts/check-env.sh" "$MODE" || exit 1

# 2. Python import
echo ""; echo "=== Import 完整性检查 ==="
cd "$ROOT_DIR/backend"
ERR=$(APP_ENV="$MODE" .venv/Scripts/python -c "from app.main import app" 2>&1 >/dev/null)
if [ $? -ne 0 ]; then
    echo "[FAIL] Python imports 失败:"; echo "$ERR" | tail -5; exit 1
fi
echo "[OK] all imports resolve"

# 3. TypeScript
echo ""; echo "=== TypeScript 编译检查 ==="
cd "$ROOT_DIR/frontend"
export PATH="/d/Program Files/nodejs:$PATH"
ERR=$(npx tsc --noEmit --skipLibCheck 2>&1)
if [ $? -ne 0 ]; then
    echo "[FAIL] TypeScript 编译错误:"; echo "$ERR" | head -10; exit 1
fi
echo "[OK] TypeScript compiles"

# 4. 未跟踪源文件
echo ""; echo "=== 未跟踪文件检查 ==="
UNTRACKED=$(cd "$ROOT_DIR" && git ls-files --others --exclude-standard '*.py' '*.ts' '*.tsx' 2>/dev/null | grep -v __pycache__ | grep -v '.claude/worktrees' | grep -v '.playwright-mcp')
if [ -n "$UNTRACKED" ]; then
    echo "[FAIL] 以下源文件未 git add — 合并代码时会丢失:"
    echo "$UNTRACKED" | sed 's/^/  /'
    exit 1
fi
echo "[OK] no untracked source files"
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "pre-commit hook 已安装 ── 覆盖 5 项检查:"
echo "  1. 分支规范 — master 禁止直接开发"
echo "  2. 环境配置 — CORS/端口/数据库"
echo "  3. Python import — 无僵尸文件/重复定义"
echo "  4. TypeScript — 编译零错误"
echo "  5. 未跟踪源文件 — 防止写了代码忘 git add"
