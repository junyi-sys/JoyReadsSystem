#!/bin/bash
# 冒烟测试 — 启动服务后调所有核心 API，验证全 200
# 用法: bash scripts/smoke-test.sh [production|development]
# 默认: development

set -e

MODE="${1:-development}"
if [ "$MODE" = "production" ]; then
    PORT=8001
    FRONTEND_PORT=3001
else
    PORT=8002
    FRONTEND_PORT=3002
fi

BASE="http://localhost:$PORT"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
    local label="$1"
    local method="${2:-GET}"
    local url="$3"
    local data="${4:-}"

    if [ "$method" = "POST" ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -X POST "$url" -H "X-Student-ID: 1" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
    else
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" -H "X-Student-ID: 1" 2>/dev/null)
    fi

    if [ "$code" = "200" ] || [ "$code" = "201" ]; then
        echo -e "  ${GREEN}[OK]${NC} $label ($code)"
        PASS=$((PASS + 1))
    elif [ "$code" = "000" ]; then
        echo -e "  ${RED}[FAIL]${NC} $label — 服务无响应"
        FAIL=$((FAIL + 1))
    else
        echo -e "  ${YELLOW}[WARN]${NC} $label ($code)"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== 冒烟测试 ($MODE 环境) ==="
echo "后端: $BASE"
echo ""

# 后端 API
echo "--- 后端核心 API ---"
check "健康检查"              GET  "$BASE/api/health"
check "学生列表"              GET  "$BASE/api/students/"
check "今日文章"              GET  "$BASE/api/articles/today"
check "精读计划"              GET  "$BASE/api/plan/current"
check "好奇心事件"            GET  "$BASE/api/curiosity/events"
check "生字统计"              GET  "$BASE/api/characters/stats"
check "阅读统计"              GET  "$BASE/api/stats/overview"
check "知识图谱"              GET  "$BASE/api/knowledge/graph"
check "TTS 合成"              POST "$BASE/api/tts/synthesize" '{"text":"测试","speed":1.0}'
echo ""

# 前端
echo "--- 前端 ---"
check "前端页面"              GET  "http://localhost:$FRONTEND_PORT"
echo ""

echo "结果: $PASS 通过, $FAIL 失败"

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}冒烟测试未通过${NC}"
    exit 1
else
    echo -e "${GREEN}冒烟测试全部通过${NC}"
fi
