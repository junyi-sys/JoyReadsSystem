# 精读计划 · 导读语音对话引擎

## 目标

将精读计划 Stage 0（导读）从静态文字展示改造为**引导员对话体验**。系统化身耐心的阅读伙伴，通过 TTS + STT + LLM 与孩子进行自然的多轮对话，引导孩子进入阅读状态。

## 核心理念

不是给导读加一个录音按钮，而是**系统化身引导员，和孩子进行自然对话**。引导员说短句、不纠错、不施压，孩子可以随时切回文字模式。

## 引导员人设

- 俊宜的阅读伙伴，不是老师，不是考官
- 说短句，口语化，像朋友聊天
- 永远不评判发音和正误，只对回答内容做反应
- 孩子沉默时轻轻换个方式问，不催促
- 每次只说一件事

## 对话规则

LLM 将 lesson JSON 的 `pre_reading` 内容拆为若干 talking points，逐个和孩子聊。每个 point 默认 **1 轮就过**，最多 3 轮。

```
每个 talking point：
  第 1 轮：引导员提问 → 孩子回答
    ├─ 有实质回应 → LLM 给一句正向接话 → 进入下一个点
    ├─ 回应模糊 → "嗯，那我换个方式问你……" → 第 2 轮
    └─ 沉默       → 给备选答案让选，或直接进入下一个点

  第 2 轮（追问）：
    ├─ 有回应   → 接话 → 下一个点
    └─ 沉默     → 给备选答案让选，或直接进下一个点

  第 3 轮（最多）：
    无论如何 → 接话后进入下一个点
```

所有点聊完后，引导员自然过渡："好了，我们来看看故事里是怎么说的吧！" → 进入 Stage 1。

## 三条铁律

1. **不纠音、只鼓励** — 不对发音做任何评判，只对回答内容做反应
2. **沉默兜底** — 不说话时提供备选答案，或用不同方式再问一遍
3. **保留文字模式** — 语音是新增通道，随时可切回点读/打字

## 后端设计

### 新增文件：`backend/app/domains/plan/dialogue.py`

```
DialogueEngine 类：
  - __init__(lesson_json, student_cognition_level)
  - generate_talking_points() → list[str]
      从 pre_reading.background + hook + main_question 提取交谈要点
  - process_turn(point_index, round_in_point, child_text, talking_points) → TurnResult
      调用 LLM 判断孩子回应，生成引导员接话

TurnResult:
  - tts_text: str           # 引导员要说的话
  - feedback_type: str      # "encourage" | "rephrase" | "offer_choices" | "move_on"
  - choices: list[str] | None  # 沉默时的备选答案
  - next_point: bool        # 是否进入下一个 talking point
  - done: bool              # 是否全部结束（进入 Stage 1）
```

### LLM 提示词

```
你是俊宜的阅读伙伴，正在"导读"环节和他聊天。
你的任务：围绕一个话题点，和孩子进行简短的对话，引导他对即将阅读的内容产生兴趣。

规则：
- 你每次只说 1-2 句话，口语化、亲切
- 不对发音做任何评判，只对回答内容回应
- 孩子回答切题 → 给一句鼓励，自然过渡到下一个点
- 孩子回答模糊 → 换个简单的方式再问一次
- 孩子沉默 → 给 1-2 个备选答案让他选，或者自然过渡
- 同一个点最多追问 3 轮，之后无论如何都进入下一个点

当前话题：{talking_points[point_index]}
前面的要点已经聊完了：{talking_points[:point_index]}
这是一个 {cognition_level} 级的孩子
这是第 {round_in_point} 轮
孩子说：{child_text}

请返回 JSON：
{{
  "tts_text": "引导员说的话",
  "feedback_type": "encourage|rephrase|offer_choices|move_on",
  "choices": ["备选1", "备选2"],  // 仅 silence 时
  "next_point": true/false,
  "done": false
}}
```

### API 端点

**1. `POST /api/plan/days/{day_id}/dialogue/start`**

启动导读对话。从 PlanDay 读取 lesson_json，生成 talking points，返回第一句 TTS 文本。

Response:
```json
{
  "talking_points": ["背景知识要点1", "围绕主问题的引导2", ...],
  "first_tts": "嘿，今天我们要读一个很有趣的故事！你先猜猜……",
  "total_points": 3
}
```

**2. `POST /api/plan/days/{day_id}/dialogue/turn`**

提交孩子回应，获取引导员下一句话。

Request:
```json
{
  "point_index": 0,
  "round_in_point": 1,
  "child_text": "小兔子想过河",
  "talking_points": ["..."]
}
```

Response:
```json
{
  "tts_text": "小兔子想过河！对，你一下就猜到了。那我们来看看它到底怎么过去的……",
  "feedback_type": "encourage",
  "choices": null,
  "next_point": true,
  "done": false
}
```

当 `done: true` 时，前端自动进入 Stage 1。

### 依赖

- Edge-TTS（已有）：`TTSService.synthesize(text)` → audio bytes
- faster-whisper（已有）：`STTService.transcribe_bytes(audio, filename)` → text
- LLM（已有）：`Container.llm().generate(prompt, system, temperature, max_tokens)`

## 前端改造

### Stage 0 UI 改造（ReadingSessionPage.tsx）

从静态卡片变为对话界面：

```
┌─────────────────────────────────────────┐
│  🎯 今天要搞懂：小兔子怎么过河的？       │  ← 主问题固定顶部
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────┐                   │
│  │ 🧑 引导员         │                   │
│  │ 嘿，今天有个有趣的  │  ← TTS 气泡      │
│  │ 故事。你先猜猜...   │    点击可重播     │
│  └──────────────────┘                   │
│                                         │
│          ┌──────────────────────┐       │
│          │ 🎤 小兔子想过河      │       │  ← 孩子回应气泡
│          └──────────────────────┘       │
│                                         │
│  ┌──────────────────┐                   │
│  │ 🧑 引导员         │                   │
│  │ 对！你一下就猜到了。 │  ← 接话         │
│  │ 我们来看看到底...   │                   │
│  └──────────────────┘                   │
│                                         │
│  ── 对话区域（自动滚动）──               │
│                                         │
│  [🎤 用声音回答]  [✏️ 打字回答]          │  ← 底部输入区
│  [跳过对话，直接开始阅读]                │  ← 始终可见
└─────────────────────────────────────────┘
```

### 交互流程

1. 页面加载 → `POST dialogue/start` → 获取 first_tts → 自动播放
2. 孩子点 🎤 → 录音 → STT 转文字 → `POST dialogue/turn` → 获取下一句 TTS → 自动播放
3. 重复直到 `done: true` → 自动进入 Stage 1
4. 任何时刻可点"跳过"直接进入 Stage 1

### 新增/修改文件

| 文件 | 操作 |
|------|------|
| `frontend/src/components/reader/DialogueBubble.tsx` | 新增：对话气泡组件（引导员/孩子两种样式） |
| `frontend/src/components/reader/GuideDialogue.tsx` | 新增：导读对话容器（消息列表 + 输入区） |
| `frontend/src/pages/ReadingSessionPage.tsx` | 修改：Stage 0 替换为 GuideDialogue |
| `frontend/src/services/api.ts` | 修改：追加 dialogue/start 和 dialogue/turn |

## 数据留存

每轮对话记录在 ComprehensionRecord 中：
- `question` = talking point 文本
- `child_answer` = STT 转写文本
- `question_type` = "dialogue_turn"
- `plan_day_id` = 当前 PlanDay

对话历史不另建表，复用现有 ComprehensionRecord 结构。

## 边界情况

| 场景 | 处理 |
|------|------|
| TTS 播放失败 | 显示文字，降级为静默文字对话 |
| STT 识别为空 | 前端提示"没听清"，引导员用 rephrase 追问 |
| LLM 调用超时 | 返回预设兜底接话："有意思！我们接着往下看" |
| 孩子连续沉默 2 轮 | 引导员给备选答案或直接 move_on |
| 快速点击跳过 | 跳过对话，直接进 Stage 1，不产生对话记录 |
| 网络断开 | 对话中断，显示"网络出了问题，先读文章吧"→ 进 Stage 1 |
| 对话中切学生 | 当前对话作废，刷新页面 |

## 不做什么

- 不做实时流式 STT（不是技术验证项目）
- 不在 Stage 1/2/3 加对话（聚焦导读）
- 不存储音频文件（只存转写文本）
- 不做语音情绪识别
- 不做 TTS 音色切换
