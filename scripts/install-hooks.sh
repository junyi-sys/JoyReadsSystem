#!/bin/bash
# 安装 Git hooks — 提交前自动验证环境配置正确性
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$ROOT_DIR/.git/hooks"

PRE_COMMIT="$HOOKS_DIR/pre-commit"

cat > "$PRE_COMMIT" << 'HOOK'
#!/bin/bash
# 提交前自检 — 根据当前分支验证环境配置
# 自动安装，运行 scripts/install-hooks.sh 即可

ROOT_DIR="$(git rev-parse --show-toplevel)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "master" ]; then
    MODE=production
elif [ "$BRANCH" = "feature-dev" ]; then
    MODE=development
else
    # 不允许的其他分支
    echo "ERROR: 禁止在非 master/feature-dev 分支提交！当前: $BRANCH"
    exit 1
fi

bash "$ROOT_DIR/scripts/check-env.sh" "$MODE"
HOOK

chmod +x "$PRE_COMMIT"
echo "pre-commit hook 已安装到 $PRE_COMMIT"
echo "规则: master → production 自检 | feature-dev → development 自检"
echo "其他分支 → 拒绝提交"
