# 精读话题来源 — 好奇心种子驱动

**日期**: 2026-06-13
**状态**: 待实施
**问题**: 精读计划的话题来自硬编码的 WEEKLY_THEMES，和孩子实际兴趣无关联

---

## 一、核心理念

精读话题来源从"大人替他选"变成"从他自己的好奇心里长出来"。
孩子问过的"为什么 / 怎么会 / 是什么"类问题存入种子池（curiosity_seed 表），
精读计划优先从种子池选话题生成文章，种子用完后自动 fallback 到预设主题。

与精读重做 spec（四阶段流程改造）的关系：**两个维度独立**。
- 精读重做 = 精读**怎么读**（四阶段 UI + 状态机）
- 本 spec = 精读**读什么**（话题来源策略）

可按任意顺序实施，互不阻塞。

---

## 二、改前 vs 改后

| 维度 | 改前 | 改后 |
|------|------|------|
| 话题来源 | 仅 WEEKLY_THEMES 预设主题 | 种子池优先，WEEKLY_THEMES 兜底 |
| 内容相关性 | 固定主题（蚂蚁、彩虹、磁铁...） | 孩子自己的问题（黑洞怎么形成...） |
| 种子利用 | 只有 `grow_seed` 生成简短回答 | 种子可驱动精读文章生成 |
| 种子状态 | pending → converted（grow_seed 一步） | pending → growing → converted（精读两步） |

---

## 三、核心流程

```
PlanPage → 点击某天
  → ReadingSessionPage mount → planApi.startDay(dayId)
  → 后端 start_day:
      1. 查 pending 种子（oldest first）
      2. 有种子？
           是 → seed.status = "growing"
               用 seed.question_text 作为 topic
               PlanDay 记录 seed_id（存 guide_text JSON）
           否 → 用 WEEKLY_THEMES 预设 topic
      3. LLM 生成文章（prompt 根据来源不同）
      4. 创建 DailyArticle → 关联 PlanDay
  → 前端正常渲染
  → 某天完成阅读 → planApi.completeDay(dayId, ...)
  → 后端 complete_day:
      1. PlanDay 关联 seed_id？
           是 → seed.status = "converted"
               seed.converted_article_id = article_id
      2. (其余逻辑不变)
```

---

## 四、种子状态机

```
pending ──→ growing ──→ converted
               │
               └──→ pending (complete_day 失败/跳过时回退)
```

| 转换 | 触发点 | 说明 |
|------|--------|------|
| pending → growing | start_day | 文章已生成，正在精读中 |
| growing → converted | complete_day | 精读完成，种子已消化 |
| growing → pending | complete_day 失败 | 回退，下次可重新分配 |

---

## 五、数据模型

不改动数据库。利用现有字段承载种子信息。

**PlanDay.guide_text**（TEXT, nullable）— 当话题来源为种子时，存 JSON：
```json
{"source": "curiosity_seed", "seed_id": 7, "seed_question": "为什么蚂蚁能搬动比自己重的东西？"}
```

当话题来源为预设主题时，guide_text 保持现有内容（导读语）。

**CuriositySeed** — 现有字段，无改动：
- status 已有 pending / growing / converted / skipped
- converted_article_id 已有

---

## 六、Prompt 差异

### 种子来源

```
孩子曾经问过一个问题："{seed_question}"。
请以这个问题为线索，写一篇精读短文，适合小学生阅读。
要求：
- 标题简洁，能吸引孩子
- 正文 300-500 字，分 2-3 个自然段
- 语气像一位耐心的朋友在解释，不直接灌输答案
- 精读焦点：{focus}
```

### 预设主题（不变）

```
请写一篇儿童短文，主题类别：{topic_category}，精读焦点：{focus}。
适合小学生阅读，300-500字，使用简单易懂的汉字。
```

---

## 七、文件改动

| 操作 | 文件 | 说明 |
|------|------|------|
| 改 | `backend/app/domains/plan/service.py` | start_day: 种子优先逻辑 + 种子感知 prompt；complete_day: 种子状态联动 |
| 改 | `backend/app/domains/plan/repository.py` | 新增查询 pending 种子的方法（通过 seeds 模块） |

**不改动**：seeds 模块（只提供数据）、前端、WEEKLY_THEMES、数据库模型

---

## 八、与 seeds 模块的边界

```
plan/repository.py
  → 调用 seeds/repository.py 的 SeedRepository
  → 仅使用: get_oldest_pending(student_id)
  → 不直接操作 CuriositySeed 表
```

seeds 模块不知道精读的存在，只提供"取一个 pending 种子"和"更新状态"的接口。

---

## 九、边界情况

| 场景 | 处理 |
|------|------|
| 没有 pending 种子 | fallback 到 WEEKLY_THEMES，行为与改前一致 |
| start_day 时种子已被其他天拿走 | 条件更新（UPDATE WHERE status='pending'），affected rows=0 则已被取走，fallback |
| complete_day 时种子已被删除 | 忽略种子状态更新，不影响 complete_day 主流程 |
| 同一种子被多次 start_day | growing 状态的种子不会被 `get_oldest_pending` 返回，天然防重 |
| 精读文章生成失败 | start_day 整体失败，种子回退到 pending |

---

## 十、与精读重做 spec 的衔接

本 spec 独立于精读重做（`2026-06-13-intensive-reading-redesign.md`）。

**合流点**：精读重做中 `start_day` 改用 LLM 一次生成完整教案（JSON），本 spec 的种子感知 prompt 只需在构造教案 prompt 时把 seed_question 注入即可。两个 spec 的 prompt 可自然合并：

```
孩子曾经问过："{seed_question}"。
请以这个问题为线索，生成一篇精读教案。

返回 JSON 格式，包含 pre_reading、paragraphs、post_reading、extension。
精读焦点：{focus}
```

两个 spec 不互斥，不依赖，独立排期。
