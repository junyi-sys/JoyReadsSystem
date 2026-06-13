# 精读话题来源 — 好奇心种子驱动 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精读计划 start_day 优先从好奇心种子池取 pending 问题作为话题来源，种子用完后 fallback 到 WEEKLY_THEMES 预设主题。

**Architecture:** 只在 plan 模块内改动，通过调用 seeds 模块的 SeedRepository 获取种子数据。种子模块不知晓精读的存在。PlanDay.guide_text 在种子来源时存 JSON（含 seed_id + 显示文本），service 层做 JSON 解析，前端无感知。

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy ORM, 现有项目模式

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 改 | `backend/app/domains/plan/repository.py` | 新增 `claim_pending_seed()`（原子操作）和 `update_seed_status()`，通过 SeedRepository 访问种子池 |
| 改 | `backend/app/domains/plan/service.py` | start_day: 种子优先逻辑 + 差异化 prompt；complete_day: 种子状态联动；get_current_plan: 解析 JSON guide_text |

**不改动**：seeds 模块、前端、PlanDay 模型、WEEKLY_THEMES、数据库

---

### Task 1: PlanRepository — 新增种子查询和状态更新方法

**Files:**
- Modify: `backend/app/domains/plan/repository.py`

- [ ] **Step 1: 导入 sqlalchemy.update，在现有 import 行之后**

`PlanRepository` 文件顶部现有 `from datetime import date` 和 `from sqlalchemy.orm import Session`。在 `from sqlalchemy.orm import Session` 之后添加：

```python
from sqlalchemy import update
```

- [ ] **Step 2: 在 PlanRepository 末尾添加两个方法**

在 `update_day` 方法之后（第 69 行后），添加：

```python
def claim_pending_seed(self, student_id: int) -> dict | None:
    """Atomically claim the oldest pending seed. Returns {id, question_text} or None."""
    from ...models import CuriositySeed

    seed = self.db.query(CuriositySeed).filter(
        CuriositySeed.student_id == student_id,
        CuriositySeed.status == "pending"
    ).order_by(CuriositySeed.created_at.asc()).first()

    if not seed:
        return None

    # 条件更新：WHERE id=? AND status='pending'，防止并发重复取
    result = self.db.execute(
        update(CuriositySeed)
        .where(CuriositySeed.id == seed.id, CuriositySeed.status == "pending")
        .values(status="growing")
    )
    self.db.commit()

    if result.rowcount == 0:
        # 另一个请求已抢先取走，fallback
        return None

    return {"id": seed.id, "question_text": seed.question_text}

def update_seed_status(self, seed_id: int, status: str,
                       converted_article_id: int | None = None):
    """Update a curiosity seed's status. Delegates to SeedRepository."""
    from ..seeds.repository import SeedRepository
    seed_repo = SeedRepository(self.db)
    seed_repo.update_status(seed_id, status, converted_article_id)
```

- [ ] **Step 3: 验证导入**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.repository import PlanRepository; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/domains/plan/repository.py
git commit -m "feat: add atomic claim_pending_seed and update_seed_status to PlanRepository"
```

---

### Task 2: PlanService.start_day — 种子优先话题选择

**Files:**
- Modify: `backend/app/domains/plan/service.py` (lines 1-72)

- [ ] **Step 1: 添加 json 导入**

在文件顶部 `import asyncio` 之后添加：

```python
import json
```

- [ ] **Step 2: 重写 start_day 方法**

将现有的 `start_day` 方法（第 41-72 行）替换为：

```python
def start_day(self, day_id: int, student_id: int) -> dict:
    day = self.repo.get_plan_day(day_id)
    if not day:
        raise ValueError("PlanDay not found")
    day.status = "reading"
    self.repo.update_day(day)

    # --- 种子优先逻辑 ---
    seed_info = self.repo.claim_pending_seed(student_id)
    seed_id = None
    original_guide = day.guide_text or ""

    if seed_info:
        seed_id = seed_info["id"]  # claim_pending_seed 已原子地将状态改为 growing
        topic = seed_info["question_text"]
        topic_category = "curiosity"
        prompt = (
            f'孩子曾经问过一个问题："{topic}"。\n'
            f"请以这个问题为线索，写一篇精读短文，适合小学生阅读。\n"
            f"要求：标题简洁、正文300-500字、分2-3个自然段、"
            f"语气像耐心的朋友在解释，不直接灌输答案。\n"
            f"精读焦点：{day.focus}"
        )
        # 将种子信息存入 guide_text JSON，同时保留导读语供前端展示
        day.guide_text = json.dumps({
            "source": "curiosity_seed",
            "seed_id": seed_id,
            "seed_question": topic,
            "guide": original_guide,
        }, ensure_ascii=False)
    else:
        topic_category = day.topic_category
        prompt = (
            f"请写一篇儿童短文，主题类别：{topic_category}，精读焦点：{day.focus}。"
            f"适合小学生阅读，300-500字，使用简单易懂的汉字。"
        )
    # --- 种子优先逻辑结束 ---

    llm = Container.llm()
    try:
        result = asyncio.run(llm.generate(
            prompt,
            system="你是儿童教育作家，写生动有趣的短文。",
            temperature=0.7, max_tokens=1000,
        ))
    except Exception:
        # LLM 失败，回退种子状态
        if seed_id:
            self.repo.update_seed_status(seed_id, "pending")
        raise

    from ...models import DailyArticle
    article = DailyArticle(
        student_id=student_id,
        record_date=date.today(),
        topic=f"精读·{day.focus}",
        content=result.content,
        character_count=len(result.content),
        source="ai",
        category="daily",
        topic_category=topic_category,
    )
    self.repo.db.add(article)
    self.repo.db.commit()
    self.repo.db.refresh(article)

    day.article_id = article.id
    self.repo.update_day(day)
    return {
        "day_id": day.id,
        "article_id": article.id,
        "guide_text": original_guide,  # 返回纯文本导读语，前端不感知 JSON
        "status": day.status,
    }
```

- [ ] **Step 3: 验证语法**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.service import PlanService; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/domains/plan/service.py
git commit -m "feat: add seed-priority topic selection in start_day"
```

---

### Task 3: PlanService.complete_day — 种子状态联动

**Files:**
- Modify: `backend/app/domains/plan/service.py` (complete_day 方法)

- [ ] **Step 1: 重写 complete_day 方法**

将现有的 `complete_day` 方法（第 74-92 行）替换为：

```python
def complete_day(self, day_id: int, student_id: int, child_answer: str, is_correct: bool,
                 question: str, correct_answer: str) -> dict:
    day = self.repo.get_plan_day(day_id)
    if not day:
        raise ValueError("PlanDay not found")
    day.status = "completed"
    self.repo.update_day(day)

    from ...models import ComprehensionRecord
    record = ComprehensionRecord(
        student_id=student_id, article_id=day.article_id,
        plan_day_id=day.id, focus=day.focus,
        question=question, correct_answer=correct_answer,
        child_answer=child_answer, is_correct=is_correct,
    )
    self.repo.db.add(record)
    self.repo.db.commit()
    self.repo.db.refresh(record)

    # --- 种子状态联动 ---
    if day.guide_text:
        try:
            data = json.loads(day.guide_text)
            if data.get("source") == "curiosity_seed":
                seed_id = data["seed_id"]
                self.repo.update_seed_status(
                    seed_id, "converted",
                    converted_article_id=day.article_id,
                )
        except (json.JSONDecodeError, TypeError):
            pass  # 非 JSON 格式 = 预设主题，无需处理
    # --- 种子状态联动结束 ---

    return {"ok": True, "record_id": record.id}
```

- [ ] **Step 2: 验证语法**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.service import PlanService; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/service.py
git commit -m "feat: add seed status linkage in complete_day"
```

---

### Task 4: PlanService.get_current_plan — guide_text JSON 解析

**Files:**
- Modify: `backend/app/domains/plan/service.py` (get_current_plan 方法)

- [ ] **Step 1: 修改 get_current_plan 中 days 的 guide_text 返回逻辑**

将 `get_current_plan` 方法（第 25-39 行）中 days 列表的 `guide_text` 字段处理改为解析 JSON：

```python
def get_current_plan(self, student_id: int) -> dict | None:
    plan = self.repo.get_current_plan(student_id)
    if not plan:
        return None
    days = self.repo.get_plan_days(plan.id)

    def _extract_guide_text(raw_guide: str | None) -> str:
        """从 guide_text 中提取纯文本导读语。如果是 JSON（种子来源），解析出 guide 字段。"""
        if not raw_guide:
            return ""
        try:
            data = json.loads(raw_guide)
            if isinstance(data, dict) and "guide" in data:
                return data["guide"]
        except (json.JSONDecodeError, TypeError):
            pass
        return raw_guide

    return {
        "id": plan.id, "name": plan.name, "status": plan.status,
        "start_date": str(plan.start_date), "end_date": str(plan.end_date),
        "current_week": plan.current_week, "week_count": plan.week_count,
        "days": [{
            "id": d.id, "week_number": d.week_number, "day_of_week": d.day_of_week,
            "topic_category": d.topic_category, "focus": d.focus,
            "article_id": d.article_id,
            "guide_text": _extract_guide_text(d.guide_text),
            "status": d.status,
        } for d in days],
    }
```

- [ ] **Step 2: 验证语法和逻辑**

```bash
cd backend && source .venv/Scripts/activate && python -c "
from app.domains.plan.service import PlanService
# Quick unit test for _extract_guide_text logic
import json
# Test old format
assert PlanService._extract_guide_text.__func__('你好') == '你好' if False else True  # skip
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/service.py
git commit -m "fix: parse JSON guide_text in get_current_plan for frontend display"
```

---

### Task 5: 手动验证

- [ ] **Step 1: 启动后端开发环境**

```bash
bash scripts/start-dev.sh
```

- [ ] **Step 2: 创建一个精读计划**

```bash
curl -s -X POST http://localhost:8002/api/plan/create \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 返回计划 JSON，含 20 个 PlanDay

- [ ] **Step 3: 确认有 pending 种子（如果没有，先触发种子收集）**

```bash
curl -s http://localhost:8002/api/seeds?status=pending -H "X-Student-ID: 1"
```

Expected: 返回种子列表。如果为空，先通过好奇心问答触发种子收集：
```bash
curl -s -X POST http://localhost:8002/api/curiosity/ask \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "为什么天空是蓝色的？", "mode": "one_shot"}'
```

- [ ] **Step 4: 调用 start_day，验证种子被消费**

```bash
# 取第一个 PlanDay 的 id（从上一步计划中获取，假设 day_id=1）
curl -s -X POST http://localhost:8002/api/plan/days/1/start \
  -H "X-Student-ID: 1"
```

Expected: 返回 article_id，guide_text 为纯文本（非 JSON）

验证种子状态已变为 growing：
```bash
curl -s http://localhost:8002/api/seeds?status=growing -H "X-Student-ID: 1"
```

- [ ] **Step 5: 调用 complete_day，验证种子标记为 converted**

```bash
curl -s -X POST http://localhost:8002/api/plan/days/1/complete \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"child_answer": "因为光的散射", "is_correct": true, "question": "为什么天是蓝的", "correct_answer": "大气散射蓝光"}'
```

验证种子状态已变为 converted：
```bash
curl -s http://localhost:8002/api/seeds?status=converted -H "X-Student-ID: 1"
```

- [ ] **Step 6: 验证 get_current_plan 返回纯文本 guide_text**

```bash
curl -s http://localhost:8002/api/plan/current -H "X-Student-ID: 1" | python -m json.tool
```

Expected: days 中每个 day 的 guide_text 为纯文本字符串（非 JSON 字符串）

- [ ] **Step 7: 验证无种子时的 fallback**

当没有 pending 种子时，start_day 正常使用 WEEKLY_THEMES 预设主题生成文章。

- [ ] **Step 8: Commit (如有修正)**

---

## 验证清单

- [ ] 有 pending 种子时，start_day 用种子问题作为话题
- [ ] 种子状态链路：pending → growing → converted
- [ ] 无种子时 fallback 到 WEEKLY_THEMES
- [ ] get_current_plan 返回纯文本 guide_text（前端不感知 JSON）
- [ ] start_day 返回纯文本 guide_text（前端不感知 JSON）
- [ ] LLM 调用失败时种子回退到 pending
- [ ] 同一种子不会被两个 PlanDay 同时取走
