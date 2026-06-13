# 精读重做 — 主问题+子问题链 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精读流程从"一篇短文 + 一道归纳题"升级为"主问题贯穿 + 子问题链（找线索→推因果→联生活→回到主问题）"的四阶段精读体验。

**Architecture:** 后端 start_day 调用 LLM 一次生成完整教案 JSON（含 main_question、分段 clue_prompt、sub_questions[]），guide_text 存 JSON；前端 ReadingSessionPage 重写为四阶段状态机，主问题固顶始终可见。complete_day 接受 4 题答案数组。

**Tech Stack:** Python 3.12 + FastAPI + LangGraph | React 18 + TypeScript + Ant Design + Framer Motion

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 改 | `backend/app/domains/plan/router.py` | `CompleteDayBody` 改为数组 |
| 改 | `backend/app/domains/plan/service.py` | `start_day` 生成结构化教案 JSON；`complete_day` 处理多题答案 |
| 改 | `frontend/src/types/index.ts` | 新增 `LessonPlan`、`SubQuestion` 类型 |
| 改 | `frontend/src/services/api.ts` | `completeDay` 参数类型调整 |
| 重写 | `frontend/src/pages/ReadingSessionPage.tsx` | 四阶段流程 + 主问题固顶 |
| 改 | `frontend/src/pages/PlanPage.tsx` | 卡片显示进度 (x/4) |

---

### Task 1: 后端 — CompleteDayBody 改为数组

**Files:**
- Modify: `backend/app/domains/plan/router.py`

- [ ] **Step 1: 重写 CompleteDayBody 和 complete_day 端点**

将现有的 `CompleteDayBody` 类和 `complete_day` 函数替换为：

```python
from pydantic import BaseModel, Field
from typing import List

class AnswerItem(BaseModel):
    question_type: str = Field(..., max_length=30, description="find_clue|infer_cause|connect_life|main_question")
    question: str = Field(..., max_length=500)
    child_answer: str = Field(..., max_length=500)
    is_correct: bool = True

class CompleteDayBody(BaseModel):
    answers: List[AnswerItem] = Field(..., min_length=1, max_length=10)


@router.post("/days/{day_id}/complete")
def complete_day(day_id: int, body: CompleteDayBody,
                 student_id: int = Depends(get_current_student_id),
                 db: Session = Depends(get_db)):
    svc = PlanService(db)
    try:
        return svc.complete_day(day_id, student_id, body.answers)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

注意：文件顶部的 import 需要添加 `List`：
```python
from typing import List
```

- [ ] **Step 2: 验证语法**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.router import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/router.py
git commit -m "feat: update CompleteDayBody to accept answer array"
```

---

### Task 2: 后端 — start_day 生成结构化教案 JSON

**Files:**
- Modify: `backend/app/domains/plan/service.py` (start_day 方法)

下面只列出替换后完整的 `start_day` 方法。

- [ ] **Step 1: 替换 start_day 方法**

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
        seed_id = seed_info["id"]
        topic = seed_info["question_text"]
        topic_category = "curiosity"
    else:
        topic = f"{day.topic_category}·{day.focus}"
        topic_category = day.topic_category

    # --- LLM 生成完整教案 JSON ---
    lesson_prompt = f"""你是一位儿童阅读教育专家。请为以下话题生成一篇精读教案。

话题：{topic}
精读焦点：{day.focus}

返回严格的 JSON 格式（不要包含任何其他文字）：

{{
  "main_question": "这篇文章要搞懂的核心问题（一个完整的问句，适合小学生）",
  "pre_reading": {{
    "background": "2-3句背景小知识，关联孩子的生活经验",
    "hook": "用孩子能懂的语言抛出主问题，告诉他答案藏在文章里"
  }},
  "paragraphs": [
    {{
      "text": "文章第1段，150-200字",
      "clue_prompt": "这段里有解决主问题的什么线索？引导孩子找出来",
      "clue_hint": "这段的关键线索是什么（供AI判断孩子答案时参考）"
    }},
    {{
      "text": "文章第2段，150-200字",
      "clue_prompt": "这段告诉我们什么新信息？",
      "clue_hint": "这段的关键线索"
    }},
    {{
      "text": "文章第3段，150-200字",
      "clue_prompt": "最后这段补充了什么？",
      "clue_hint": "这段的关键线索"
    }}
  ],
  "sub_questions": [
    {{
      "type": "find_clue",
      "label": "找线索",
      "question": "从文章里找到的关键信息是什么？（引导孩子回顾文中细节）",
      "answer_hint": "孩子应该提到的关键点"
    }},
    {{
      "type": "infer_cause",
      "label": "推因果",
      "question": "为什么会这样？把线索串起来想一想",
      "answer_hint": "因果推理的要点"
    }},
    {{
      "type": "connect_life",
      "label": "联生活",
      "question": "你有没有见过或经历过类似的事？",
      "answer_hint": "生活中类似的例子"
    }}
  ],
  "extension": {{
    "back_to_main": "现在你能回答最开始的问题了吗？（用主问题本身的表述）",
    "ai_feedback_hint": "从哪些角度评价孩子的回答"
  }}
}}

要求：
- main_question 是整篇文章的灵魂，子问题都要服务于它
- 3段文章合起来 300-500 字，适合小学生阅读
- 每个 clue_prompt 帮助孩子从该段中找线索，逐步拼出答案
- sub_questions 三个类型：find_clue（从文中找信息）→ infer_cause（推理因果）→ connect_life（联系生活）
- 语言亲切、鼓励性强，像一位耐心的老师在引导"""

    llm = Container.llm()
    try:
        result = asyncio.run(llm.generate(
            lesson_prompt,
            system="你是儿童阅读教育专家，擅长设计探究式精读课程。严格按照要求的 JSON 格式返回。",
            temperature=0.7, max_tokens=2000,
        ))
        lesson_json = json.loads(result.content)
    except (json.JSONDecodeError, Exception):
        # JSON 解析失败，回退到旧模式
        if seed_id:
            self.repo.update_seed_status(seed_id, "pending")
        lesson_json = None

    if lesson_json is None:
        # 回退：生成简单文章
        fallback_prompt = (
            f"请写一篇儿童短文，主题：{topic}，精读焦点：{day.focus}。"
            f"适合小学生阅读，300-500字，使用简单易懂的汉字。"
        )
        result = asyncio.run(llm.generate(
            fallback_prompt,
            system="你是儿童教育作家，写生动有趣的短文。",
            temperature=0.7, max_tokens=1000,
        ))
        article_content = result.content
        guide_text_json = original_guide
    else:
        article_content = "\n\n".join(p["text"] for p in lesson_json["paragraphs"])
        guide_text_json = json.dumps({
            "version": "v2",
            "main_question": lesson_json["main_question"],
            "lesson": lesson_json,
        }, ensure_ascii=False)

    # --- 保存种子信息 ---
    if seed_id:
        if isinstance(guide_text_json, str) and guide_text_json.startswith("{"):
            data = json.loads(guide_text_json)
            data["seed_id"] = seed_id
            data["seed_question"] = topic
            guide_text_json = json.dumps(data, ensure_ascii=False)
        elif not isinstance(guide_text_json, str) or not guide_text_json.startswith("{"):
            guide_text_json = json.dumps({
                "source": "curiosity_seed",
                "seed_id": seed_id,
                "seed_question": topic,
                "guide": original_guide,
            }, ensure_ascii=False)

    day.guide_text = guide_text_json

    from ...models import DailyArticle
    article = DailyArticle(
        student_id=student_id,
        record_date=date.today(),
        topic=f"精读·{day.focus}",
        content=article_content,
        character_count=len(article_content),
        source="ai",
        category="daily",
        topic_category=topic_category,
    )
    self.repo.db.add(article)
    self.repo.db.commit()
    self.repo.db.refresh(article)

    day.article_id = article.id
    self.repo.update_day(day)

    return_guide = original_guide
    if lesson_json:
        return_guide = lesson_json["pre_reading"]["hook"]

    return {
        "day_id": day.id,
        "article_id": article.id,
        "guide_text": return_guide,
        "lesson_json": lesson_json,
        "status": day.status,
    }
```

- [ ] **Step 2: 验证语法**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.service import PlanService; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/service.py
git commit -m "feat: generate structured lesson JSON with main question + sub-questions in start_day"
```

---

### Task 3: 后端 — complete_day 处理多题答案

**Files:**
- Modify: `backend/app/domains/plan/service.py` (complete_day 方法)

- [ ] **Step 1: 替换 complete_day 方法**

```python
def complete_day(self, day_id: int, student_id: int, answers: list) -> dict:
    day = self.repo.get_plan_day(day_id)
    if not day:
        raise ValueError("PlanDay not found")
    day.status = "completed"
    self.repo.update_day(day)

    records = []
    from ...models import ComprehensionRecord
    for ans in answers:
        record = ComprehensionRecord(
            student_id=student_id, article_id=day.article_id,
            plan_day_id=day.id, focus=ans.question_type,
            question=ans.question, correct_answer="",
            child_answer=ans.child_answer, is_correct=ans.is_correct,
        )
        self.repo.db.add(record)
        self.repo.db.commit()
        self.repo.db.refresh(record)
        records.append(record.id)

    # --- 种子状态联动 ---
    if day.guide_text:
        try:
            data = json.loads(day.guide_text)
            seed_id = data.get("seed_id")
            if seed_id:
                self.repo.update_seed_status(
                    seed_id, "converted",
                    converted_article_id=day.article_id,
                )
        except (json.JSONDecodeError, TypeError):
            pass

    # --- 主问题回答保存为 Theory ---
    main_answer = next((a for a in answers if a.question_type == "main_question"), None)
    theory_id = None
    if main_answer and main_answer.child_answer:
        try:
            from ...models import Theory
            theory = Theory(
                student_id=student_id,
                title=main_answer.question[:50],
                content=main_answer.child_answer,
                linked_article_id=day.article_id,
            )
            self.repo.db.add(theory)
            self.repo.db.commit()
            self.repo.db.refresh(theory)
            theory_id = theory.id
        except Exception:
            pass

    return {"ok": True, "record_ids": records, "theory_id": theory_id}
```

注意：`answers` 参数是 `AnswerItem` Pydantic 对象列表（从 router 传入）。

- [ ] **Step 2: 验证语法**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.service import PlanService; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/service.py
git commit -m "feat: handle answer array in complete_day, auto-save main question answer as Theory"
```

---

### Task 4: 前端 — 新增类型定义

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: 在类型文件末尾添加新类型**

```typescript
export interface ClueParagraph {
  text: string
  clue_prompt: string
  clue_hint: string
}

export interface SubQuestion {
  type: 'find_clue' | 'infer_cause' | 'connect_life'
  label: string
  question: string
  answer_hint: string
}

export interface LessonPlan {
  main_question: string
  pre_reading: {
    background: string
    hook: string
  }
  paragraphs: ClueParagraph[]
  sub_questions: SubQuestion[]
  extension: {
    back_to_main: string
    ai_feedback_hint: string
  }
}

export interface AnswerItem {
  question_type: string
  question: string
  child_answer: string
  is_correct: boolean
}

export interface StartDayResponse {
  day_id: number
  article_id: number
  guide_text: string
  lesson_json: LessonPlan | null
  status: string
}

export interface CompleteDayResponse {
  ok: boolean
  record_ids: number[]
  theory_id: number | null
}
```

- [ ] **Step 2: 验证编译**

```bash
cd frontend && export PATH="/d/Program Files/nodejs:$PATH" && npx tsc --noEmit src/types/index.ts 2>&1 | head -5
```

Expected: 无错误或仅有项目已有的错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add LessonPlan, SubQuestion, AnswerItem types for intensive reading V2"
```

---

### Task 5: 前端 — 更新 API 封装

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 更新 planApi**

将 `planApi` 中的 `completeDay` 方法替换为：

```typescript
export const planApi = {
  create: () => api.post('/plan/create'),
  current: () => api.get('/plan/current'),
  startDay: (dayId: number) => api.post(`/plan/days/${dayId}/start`),
  completeDay: (dayId: number, body: { answers: { question_type: string; question: string; child_answer: string; is_correct: boolean }[] }) =>
    api.post(`/plan/days/${dayId}/complete`, body),
}
```

并确保文件顶部有正确的 import（已存在，无需修改）。

- [ ] **Step 2: 验证编译**

```bash
cd frontend && export PATH="/d/Program Files/nodejs:$PATH" && npx tsc --noEmit 2>&1 | head -10
```

Expected: 可能有预先存在的错误，不应新增与 planApi 相关的类型错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: update planApi.completeDay signature for answer array"
```

---

### Task 6: 前端 — 重写 ReadingSessionPage

**Files:**
- Rewrite: `frontend/src/pages/ReadingSessionPage.tsx`

- [ ] **Step 1: 完全重写组件**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Spin, Typography, Steps, Tag, Progress } from 'antd'
import { SoundOutlined, BulbOutlined, SearchOutlined, LinkOutlined, TrophyOutlined } from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { planApi, articlesApi } from '../services/api'
import ArticleReader from '../components/reader/ArticleReader'
import VoiceInputButton from '../components/ui/VoiceInputButton'
import type { ArticleWithPinyin, LessonPlan, SubQuestion } from '../types'

const { Title, Paragraph, Text } = Typography

const QUESTION_ICONS: Record<string, React.ReactNode> = {
  find_clue: <SearchOutlined />,
  infer_cause: <BulbOutlined />,
  connect_life: <LinkOutlined />,
}

const STAGE_LABELS = ['读前热身', '读中探究', '读后思考', '回到主问题']

export default function ReadingSessionPage() {
  const { dayId } = useParams<{ dayId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [lesson, setLesson] = useState<LessonPlan | null>(null)
  const [guideText, setGuideText] = useState('')
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [currentParagraph, setCurrentParagraph] = useState(0)
  const [currentSubQuestion, setCurrentSubQuestion] = useState(0)
  const [answers, setAnswers] = useState<{ question_type: string; question: string; child_answer: string; is_correct: boolean }[]>([])
  const [clueAnswers, setClueAnswers] = useState<string[]>([])

  useEffect(() => {
    if (!dayId) return
    planApi.startDay(Number(dayId)).then(({ data }) => {
      setGuideText(data.guide_text)
      setLesson(data.lesson_json)
      articlesApi.get(data.article_id).then(({ data: art }) => {
        setArticle(art)
        setLoading(false)
      })
    }).catch(() => setLoading(false))
  }, [dayId])

  const addAnswer = useCallback((questionType: string, question: string, childAnswer: string, isCorrect = true) => {
    setAnswers(prev => [...prev, { question_type: questionType, question, child_answer: childAnswer, is_correct: isCorrect }])
  }, [])

  const handleComplete = async () => {
    if (!dayId) return
    await planApi.completeDay(Number(dayId), { answers })
    setStep(4)
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>

      {/* 主问题固顶 */}
      {lesson?.main_question && (
        <Card size="small" style={{
          marginBottom: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFF7E6, #FFF1CC)',
          border: '1px solid #FFD666'
        }}>
          <Text strong style={{ fontSize: 15, color: '#AD6800' }}>
            🎯 今天要搞懂：{lesson.main_question}
          </Text>
        </Card>
      )}

      {/* 进度条 */}
      <Steps current={step} size="small" style={{ marginBottom: 24 }}
        items={STAGE_LABELS.map(label => ({ title: label }))} />

      <AnimatePresence mode="wait">
        {/* Stage 0: 读前热身 */}
        {step === 0 && lesson && (
          <motion.div key="pre" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <SoundOutlined style={{ fontSize: 48, color: '#4DABF7' }} />
              <Title level={4} style={{ marginTop: 16 }}>你知道吗？</Title>
              <Paragraph style={{ fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
                {lesson.pre_reading.background}
              </Paragraph>
              <div style={{
                marginTop: 24, padding: '16px 24px',
                background: '#FFF7E6', borderRadius: 12, display: 'inline-block'
              }}>
                <Text style={{ fontSize: 16 }}>{lesson.pre_reading.hook}</Text>
              </div>
              <br />
              <Button type="primary" size="large" onClick={() => setStep(1)}
                style={{ borderRadius: 16, marginTop: 24 }}>我准备好了，开始读！</Button>
            </Card>
          </motion.div>
        )}

        {/* Stage 1: 读中探究 — 分段阅读 */}
        {step === 1 && article && lesson && (
          <motion.div key="during" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16 }}>
              {/* 进度 */}
              <Progress percent={Math.round(((currentParagraph + 1) / lesson.paragraphs.length) * 100)}
                size="small" style={{ marginBottom: 16 }}
                format={() => `段落 ${currentParagraph + 1}/${lesson.paragraphs.length}`} />

              <ArticleReader
                article={{ ...article, content: lesson.paragraphs[currentParagraph].text }}
                isRead={false}
                onReadComplete={() => {
                  const cp = currentParagraph
                  addAnswer(
                    'find_clue',
                    lesson.paragraphs[cp].clue_prompt,
                    clueAnswers[cp] || '继续阅读',
                  )
                  if (cp < lesson.paragraphs.length - 1) {
                    setCurrentParagraph(cp + 1)
                  } else {
                    setStep(2)
                  }
                }}
              />

              {/* 线索提示 */}
              <Card size="small" style={{ marginTop: 16, background: '#F0F5FF', borderRadius: 8 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  🔍 {lesson.paragraphs[currentParagraph].clue_prompt}
                </Text>
              </Card>
            </Card>
          </motion.div>
        )}

        {/* Stage 2: 读后思考 — 子问题链 */}
        {step === 2 && lesson && (
          <motion.div key="post" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <Progress percent={Math.round(((currentSubQuestion) / lesson.sub_questions.length) * 100)}
                size="small" style={{ marginBottom: 16 }}
                format={() => `子问题 ${currentSubQuestion + 1}/${lesson.sub_questions.length}`} />

              <Tag color="blue" style={{ marginBottom: 12, fontSize: 13 }}>
                {QUESTION_ICONS[lesson.sub_questions[currentSubQuestion].type]}
                {' '}{lesson.sub_questions[currentSubQuestion].label}
              </Tag>

              <Title level={4}>{lesson.sub_questions[currentSubQuestion].question}</Title>

              <VoiceInputButton onResult={(text) => setTranscript(text)} />

              {transcript && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="green">你说的：{transcript}</Tag>
                  <br />
                  <Button type="primary" size="large" onClick={() => {
                    addAnswer(
                      lesson.sub_questions[currentSubQuestion].type,
                      lesson.sub_questions[currentSubQuestion].question,
                      transcript,
                      true,
                    )
                    setTranscript('')
                    if (currentSubQuestion < lesson.sub_questions.length - 1) {
                      setCurrentSubQuestion(prev => prev + 1)
                    } else {
                      setStep(3)
                    }
                  }} style={{ borderRadius: 16, marginTop: 16 }}>下一题</Button>
                </div>
              )}
              <Button onClick={() => {
                addAnswer(
                  lesson.sub_questions[currentSubQuestion].type,
                  lesson.sub_questions[currentSubQuestion].question,
                  '跳过此题',
                  true,
                )
                setTranscript('')
                if (currentSubQuestion < lesson.sub_questions.length - 1) {
                  setCurrentSubQuestion(prev => prev + 1)
                } else {
                  setStep(3)
                }
              }} type="text" style={{ marginTop: 8 }}>跳过，直接下一题</Button>
            </Card>
          </motion.div>
        )}

        {/* Stage 3: 回到主问题 */}
        {step === 3 && lesson && (
          <motion.div key="main" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <TrophyOutlined style={{ fontSize: 48, color: '#FFD666' }} />
              <Title level={4} style={{ marginTop: 16 }}>回到最开始的问题</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                {lesson.extension.back_to_main}
              </Paragraph>
              <VoiceInputButton onResult={(text) => setTranscript(text)} />
              {transcript && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="blue">你的回答：{transcript}</Tag>
                  <br />
                  <Button type="primary" size="large" onClick={() => {
                    addAnswer('main_question', lesson.main_question, transcript, true)
                    handleComplete()
                  }} style={{ borderRadius: 16, marginTop: 16 }}>提交并完成！</Button>
                </div>
              )}
              <Button onClick={() => {
                addAnswer('main_question', lesson.main_question, '已完成精读', true)
                handleComplete()
              }} type="text" style={{ marginTop: 8 }}>跳过录音，直接完成</Button>
            </Card>
          </motion.div>
        )}

        {/* 回退模式：无 lesson_json 时显示旧版 */}
        {!lesson && (
          <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Step 0: 导读 */}
            {step === 0 && (
              <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
                <SoundOutlined style={{ fontSize: 48, color: '#4DABF7' }} />
                <Title level={3} style={{ marginTop: 16 }}>{guideText}</Title>
                <Button type="primary" size="large" onClick={() => setStep(1)}
                  style={{ borderRadius: 16, marginTop: 24 }}>开始阅读</Button>
              </Card>
            )}
            {/* Step 1: 阅读 */}
            {step === 1 && article && (
              <Card style={{ borderRadius: 16 }}>
                <ArticleReader article={article} isRead={false} onReadComplete={() => setStep(2)} />
              </Card>
            )}
            {/* Step 2-3: 合并为归纳 */}
            {(step === 2 || step === 3) && (
              <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
                <Title level={4}>说说你的想法</Title>
                <Paragraph type="secondary">这篇文章讲了什么？</Paragraph>
                <VoiceInputButton onResult={(text) => setTranscript(text)} />
                {transcript && (
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue">你说的：{transcript}</Tag>
                    <br />
                    <Button type="primary" size="large" onClick={() => {
                      addAnswer('main_question', '这篇文章讲了什么？', transcript || '已完成归纳', true)
                      handleComplete()
                    }} style={{ borderRadius: 16, marginTop: 16 }}>完成今天的精读！</Button>
                  </div>
                )}
                <Button onClick={() => {
                  addAnswer('main_question', '这篇文章讲了什么？', '已完成归纳', true)
                  handleComplete()
                }} type="text" style={{ marginTop: 8 }}>跳过录音，直接完成</Button>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 4: 完成 */}
      {step === 4 && (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
            <Title level={3}>太棒了！</Title>
            <Paragraph>你把今天的问题都搞懂了，明天继续探索！</Paragraph>
            <Button type="primary" size="large" onClick={() => navigate('/plan')}
              style={{ borderRadius: 16, marginTop: 16 }}>返回计划</Button>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
cd frontend && export PATH="/d/Program Files/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep -i "ReadingSessionPage" | head -10
```

Expected: 不应有 ReadingSessionPage 相关的类型错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReadingSessionPage.tsx
git commit -m "feat: rewrite ReadingSessionPage with 4-stage main-question-driven flow"
```

---

### Task 7: 前端 — PlanPage 显示进度

**Files:**
- Modify: `frontend/src/pages/PlanPage.tsx`

- [ ] **Step 1: 给日卡片添加进度标记**

找到 PlanPage 中渲染每天卡片的代码（通常在 map 循环中）。在现有 `{d.status === 'completed' && '已完成'}` 等状态标记旁边，添加 `topic_category === 'curiosity'` 的标记。

找到类似这样的代码段：
```tsx
<generic ref={e78}>
  <generic ref={e79}>{d.focus}</generic>
  <strong>{dayLabel}</strong>
  <text>{d.topic_category}</text>
</generic>
<generic>{statusLabel}</generic>
```

修改为在 topic_category 区域添加种子来源标记：
```tsx
<text>
  {d.topic_category}
  {d.topic_category === 'curiosity' && ' 💡'}
</text>
```

注：PlanPage.tsx 实际渲染代码需根据当前文件内容精确定位。核心改动：当 `topic_category === 'curiosity'` 时显示一个灯泡图标或"来自你的问题"标签。

- [ ] **Step 2: 验证编译**

```bash
cd frontend && export PATH="/d/Program Files/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep -i "PlanPage" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PlanPage.tsx
git commit -m "feat: add curiosity source indicator on plan day cards"
```

---

### Task 8: 手动端到端验证

- [ ] **Step 1: 启动前后端**

```bash
bash scripts/start-dev.sh
```

- [ ] **Step 2: 创建计划并点击一个待开始的天**

验证：
- 读前热身页出现，显示背景知识和主问题
- 主问题固顶卡片显示
- 分段阅读 + 线索提示

- [ ] **Step 3: 完成子问题链**

验证：
- 找线索 → 推因果 → 联生活三题依次出现
- 语音输入可用

- [ ] **Step 4: 回到主问题**

验证：
- 主问题重新展示
- 语音回答后提交

- [ ] **Step 5: 验证回退模式**

确认当 LLM 返回非 JSON 时，显示旧版流程（导读→阅读→归纳→完成）

- [ ] **Step 6: 验证种子→精读联动**

确认从好奇心种子生成的文章，主问题就是孩子问的问题

---

## 验证清单

- [ ] start_day 返回 `lesson_json` 含 `main_question` + `sub_questions[]`
- [ ] LLM JSON 解析失败时回退旧模式
- [ ] complete_day 接受 4 题答案数组
- [ ] 主问题固顶卡片在除完成外的所有阶段可见
- [ ] 子问题链按找线索→推因果→联生活顺序展示
- [ ] 主问题回答保存为 Theory
- [ ] 种子→精读的主问题就是孩子问的问题
- [ ] 回退模式正常工作
