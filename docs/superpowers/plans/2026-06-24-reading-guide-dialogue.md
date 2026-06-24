# 导读语音对话引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the reading plan Stage 0 (导读) from static text into a conversational guide persona using TTS + STT + LLM.

**Architecture:** New `DialogueEngine` class in `plan/dialogue.py` handles talking-point extraction and per-turn LLM processing. Two new API endpoints (`dialogue/start`, `dialogue/turn`) serve the frontend. Frontend `GuideDialogue` component replaces the static Stage 0 card with a chat-style interface with auto-TTS playback.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React 18 + TypeScript + Ant Design 5 (frontend), Edge-TTS + faster-whisper + DeepSeek LLM

## Global Constraints

- 不纠音、只鼓励 — 不对发音做任何评判
- 每个 talking point 默认 1 轮，最多 3 轮
- 保留文字模式，随时可跳过语音对话
- 复用现有 TTS/STT/LLM 基础设施，不引入新依赖
- 音频不存储，只存 STT 转写文本
- 仅 Stage 0（导读），不扩散到其他阶段

---

## File Structure

| File | Role |
|------|------|
| `backend/app/domains/plan/dialogue.py` | DialogueEngine — talking points generation + per-turn LLM processing |
| `backend/app/domains/plan/router.py` | Add `POST dialogue/start` and `POST dialogue/turn` endpoints |
| `frontend/src/types/index.ts` | Add dialogue types |
| `frontend/src/services/api.ts` | Add `dialogueStart()` and `dialogueTurn()` |
| `frontend/src/components/reader/DialogueBubble.tsx` | Single message bubble (guide / child) |
| `frontend/src/components/reader/GuideDialogue.tsx` | Dialogue container — message list, recording, skip |
| `frontend/src/pages/ReadingSessionPage.tsx` | Replace Stage 0 with GuideDialogue |

---

### Task 1: Create DialogueEngine backend

**Files:**
- Create: `backend/app/domains/plan/dialogue.py`

**Interfaces:**
- Produces: `DialogueEngine(lesson_json: dict, cognition_level: int)`, `generate_talking_points() -> list[str]`, `process_turn(point_index, round_in_point, child_text, talking_points) -> dict`

- [ ] **Step 1: Write the DialogueEngine class**

```python
"""导读对话引擎 — LLM-driven dialogue for pre-reading guide stage."""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

DIALOGUE_SYSTEM_PROMPT = """你是俊宜的阅读伙伴，正在"导读"环节和他聊天。
你的任务：围绕一个话题点，和孩子进行简短的对话，引导他对即将阅读的内容产生兴趣。

规则：
- 你每次只说 1-2 句话，口语化、亲切，像朋友聊天
- 不对发音做任何评判，只对回答内容回应
- 孩子回答切题 → 给一句鼓励，自然过渡到下一个点
- 孩子回答模糊 → 换个简单的方式再问一次
- 孩子沉默或没回应 → 给 1-2 个备选答案让他选，或者自然过渡
- 同一个点最多追问 3 轮，之后无论如何都进入下一个点
- 语言活泼有趣，用孩子能懂的词汇"""

TALKING_POINTS_PROMPT = """根据以下导读内容，拆分成 2-4 个交谈要点。
每个要点是引导员和孩子聊的一个话题，用口语化的方式呈现。

背景知识：{background}
引子：{hook}
核心问题：{main_question}

返回严格的 JSON 格式（不要包含任何其他文字）：
{{
  "points": ["要点1: 用口语化的短句", "要点2: 用口语化的短句", ...]
}}

要点要求：
- 从背景知识开始聊，再到核心问题
- 每个要点是一句引导员说的话，不是标记
- 用孩子能懂的日常语言
- 总共 2-4 个点"""

TURN_PROMPT = """当前在聊：{current_point}
前面聊过的：{previous_points}
这是一个 {level_text} 的孩子
第 {round_in_point} 轮对话
孩子说：{child_text}

请返回严格的 JSON 格式（不要包含任何其他文字）：
{{
  "tts_text": "引导员说的话（1-2句，口语化）",
  "feedback_type": "encourage|rephrase|offer_choices|move_on",
  "choices": ["备选1", "备选2"],
  "next_point": true,
  "done": false
}}

feedback_type 说明：
- encourage: 孩子有实质回应 → 鼓励 + 自然过渡
- rephrase: 回应模糊 → 换方式再问
- offer_choices: 沉默 → 给备选答案
- move_on: 已经追问过或应该跳过了 → 自然过渡

done 为 true 时，表示所有要点聊完，引导员说一句过渡语（如"好了，我们来看看故事里是怎么说的吧！"），前端进入阅读阶段。"""

COGNITION_LABELS = {
    0: "学龄前（3-5岁）",
    1: "一年级",
    2: "二年级",
    3: "三年级",
    4: "四年级",
    5: "五年级",
    6: "六年级",
}


class DialogueEngine:
    def __init__(self, lesson_json: dict, cognition_level: int = 0):
        self.pre_reading = lesson_json.get("pre_reading", {})
        self.main_question = lesson_json.get("main_question", "")
        self.cognition_level = cognition_level

    def generate_talking_points(self) -> list[str]:
        """Extract 2-4 talking points from pre_reading content using LLM."""
        from ..di import Container

        background = self.pre_reading.get("background", "")
        hook = self.pre_reading.get("hook", "")
        main_q = self.main_question

        if not background and not hook and not main_q:
            return ["今天我们来读一个有趣的故事吧！"]

        llm = Container.llm()
        prompt = TALKING_POINTS_PROMPT.format(
            background=background, hook=hook, main_question=main_q,
        )
        try:
            result = asyncio.run(llm.generate(
                prompt, system=DIALOGUE_SYSTEM_PROMPT, temperature=0.7, max_tokens=500,
            ))
            content = result.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            data = json.loads(content.strip())
            return data.get("points", [hook or main_q or "准备好了吗？"])
        except Exception as e:
            logger.warning(f"Failed to generate talking points: {e}")
            points = []
            if background:
                points.append(background)
            if hook:
                points.append(hook)
            if main_q:
                points.append(f"你觉得：{main_q}")
            return points or ["准备好了吗？"]

    def process_turn(
        self, point_index: int, round_in_point: int,
        child_text: str, talking_points: list[str],
    ) -> dict:
        """Process a single dialogue turn. Returns TurnResult as dict."""
        from ..di import Container

        current_point = talking_points[point_index] if point_index < len(talking_points) else ""
        previous = "、".join(talking_points[:point_index]) if point_index > 0 else "（还没有聊过）"

        if not child_text or not child_text.strip():
            child_text = "（孩子没有回应）"

        level_text = COGNITION_LABELS.get(self.cognition_level, "小学生")
        prompt = TURN_PROMPT.format(
            current_point=current_point,
            previous_points=previous,
            level_text=level_text,
            round_in_point=round_in_point,
            child_text=child_text,
        )

        llm = Container.llm()
        try:
            result = asyncio.run(llm.generate(
                prompt, system=DIALOGUE_SYSTEM_PROMPT, temperature=0.7, max_tokens=400,
            ))
            content = result.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            data = json.loads(content.strip())
            return {
                "tts_text": data.get("tts_text", "有意思！我们接着往下看。"),
                "feedback_type": data.get("feedback_type", "encourage"),
                "choices": data.get("choices"),
                "next_point": data.get("next_point", True),
                "done": data.get("done", False),
            }
        except Exception as e:
            logger.error(f"Dialogue turn failed: {e}")
            is_last_point = point_index >= len(talking_points) - 1
            return {
                "tts_text": "我们来看看故事里是怎么说的吧！" if is_last_point else "有意思！我们接着聊聊……",
                "feedback_type": "move_on",
                "choices": None,
                "next_point": True,
                "done": is_last_point,
            }
```

- [ ] **Step 2: Verify the file is syntactically correct**

Run: `cd backend && source .venv/Scripts/activate && python -c "from app.domains.plan.dialogue import DialogueEngine; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/dialogue.py
git commit -m "feat: add DialogueEngine for pre-reading voice dialogue

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add dialogue API endpoints

**Files:**
- Modify: `backend/app/domains/plan/router.py`

**Interfaces:**
- Produces: `POST /api/plan/days/{day_id}/dialogue/start`, `POST /api/plan/days/{day_id}/dialogue/turn`
- Produces: `DialogueStartResponse`, `DialogueTurnRequest`, `DialogueTurnResponse` pydantic models

- [ ] **Step 1: Add Pydantic models and endpoints to router.py**

Read the existing file, then add after the `CompleteDayBody` class (line 19):

```python
class DialogueTurnRequest(BaseModel):
    point_index: int = Field(..., ge=0)
    round_in_point: int = Field(..., ge=1, le=3)
    child_text: str = Field("", max_length=1000)
    talking_points: list[str] = Field(..., min_length=1, max_length=10)


@router.post("/days/{day_id}/dialogue/start")
def start_dialogue(day_id: int, student_id: int = Depends(get_current_student_id),
                   db: Session = Depends(get_db)):
    """Start the pre-reading dialogue. Returns talking points and first TTS text."""
    svc = PlanService(db)
    day = svc.repo.get_plan_day(day_id)
    if not day:
        raise HTTPException(status_code=404, detail="PlanDay not found")
    if not day.lesson_json:
        raise HTTPException(status_code=400, detail="No lesson plan for this day")

    try:
        import json
        lesson = json.loads(day.lesson_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson JSON")

    # Get student cognition level
    from ...models import Student
    student = db.query(Student).filter(Student.id == student_id).first()
    cognition = student.cognition_level if student else 0

    from .dialogue import DialogueEngine
    engine = DialogueEngine(lesson, cognition)
    points = engine.generate_talking_points()

    first_tts = points[0] if points else "准备好了吗？我们来读一个有趣的故事！"

    # Record dialogue start as a ComprehensionRecord
    from ...models import ComprehensionRecord
    record = ComprehensionRecord(
        student_id=student_id,
        article_id=day.article_id,
        plan_day_id=day.id,
        focus="dialogue_start",
        question="导读对话开始",
        child_answer=f"talking_points: {len(points)}",
    )
    db.add(record)
    db.commit()

    return {
        "talking_points": points,
        "first_tts": first_tts,
        "total_points": len(points),
    }


@router.post("/days/{day_id}/dialogue/turn")
def dialogue_turn(day_id: int, body: DialogueTurnRequest,
                  student_id: int = Depends(get_current_student_id),
                  db: Session = Depends(get_db)):
    """Process a single dialogue turn. Returns guide's response."""
    svc = PlanService(db)
    day = svc.repo.get_plan_day(day_id)
    if not day:
        raise HTTPException(status_code=404, detail="PlanDay not found")
    if not day.lesson_json:
        raise HTTPException(status_code=400, detail="No lesson plan for this day")

    try:
        import json
        lesson = json.loads(day.lesson_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson JSON")

    from ...models import Student
    student = db.query(Student).filter(Student.id == student_id).first()
    cognition = student.cognition_level if student else 0

    from .dialogue import DialogueEngine
    engine = DialogueEngine(lesson, cognition)
    result = engine.process_turn(
        body.point_index, body.round_in_point,
        body.child_text, body.talking_points,
    )

    # Record the dialogue turn
    from ...models import ComprehensionRecord
    current_point = body.talking_points[body.point_index] if body.point_index < len(body.talking_points) else ""
    record = ComprehensionRecord(
        student_id=student_id,
        article_id=day.article_id,
        plan_day_id=day.id,
        focus="dialogue_turn",
        question=current_point[:200],
        child_answer=body.child_text[:500],
    )
    db.add(record)
    db.commit()

    return result
```

Also add `import json` at the top if not already present.

- [ ] **Step 2: Verify the endpoints are registered**

Run: `cd backend && source .venv/Scripts/activate && python -c "from app.main import app; routes = [r.path for r in app.routes if hasattr(r, 'path')]; print([r for r in routes if 'dialogue' in r])"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/domains/plan/router.py
git commit -m "feat: add dialogue start/turn API endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add frontend types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add dialogue types**

Add at the end of the file:

```typescript
export interface DialogueStartResponse {
  talking_points: string[]
  first_tts: string
  total_points: number
}

export interface DialogueTurnRequest {
  point_index: number
  round_in_point: number
  child_text: string
  talking_points: string[]
}

export interface DialogueTurnResponse {
  tts_text: string
  feedback_type: 'encourage' | 'rephrase' | 'offer_choices' | 'move_on'
  choices: string[] | null
  next_point: boolean
  done: boolean
}

export interface DialogueMessage {
  role: 'guide' | 'child'
  text: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add dialogue types for voice interaction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add dialogue API calls

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add dialogue API functions**

Add to the `planApi` object:

```typescript
export const planApi = {
  create: () => api.post('/plan/create'),
  current: () => api.get('/plan/current'),
  startDay: (dayId: number) => api.post(`/plan/days/${dayId}/start`),
  completeDay: (dayId: number, body: { answers: { question_type: string; question: string; child_answer: string; is_correct: boolean }[] }) =>
    api.post(`/plan/days/${dayId}/complete`, body),
  dialogueStart: (dayId: number) =>
    api.post(`/plan/days/${dayId}/dialogue/start`),
  dialogueTurn: (dayId: number, body: { point_index: number; round_in_point: number; child_text: string; talking_points: string[] }) =>
    api.post(`/plan/days/${dayId}/dialogue/turn`, body),
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add dialogue API calls to planApi

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create DialogueBubble component

**Files:**
- Create: `frontend/src/components/reader/DialogueBubble.tsx`

**Interfaces:**
- Produces: `DialogueBubble` component — props: `role: 'guide' | 'child'`, `text: string`, `onReplay?: () => void`

- [ ] **Step 1: Write DialogueBubble component**

```tsx
import { Typography, Button } from 'antd'
import { SoundOutlined, UserOutlined, SmileOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

const { Text } = Typography

interface Props {
  role: 'guide' | 'child'
  text: string
  onReplay?: () => void
}

export default function DialogueBubble({ role, text, onReplay }: Props) {
  const isGuide = role === 'guide'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isGuide ? 'row' : 'row-reverse',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 16,
        paddingLeft: isGuide ? 0 : 40,
        paddingRight: isGuide ? 40 : 0,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isGuide ? 'linear-gradient(135deg, #4DABF7, #74C0FC)' : 'linear-gradient(135deg, #FFD43B, #FFA94D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isGuide ? (
          <SmileOutlined style={{ color: '#fff', fontSize: 18 }} />
        ) : (
          <UserOutlined style={{ color: '#fff', fontSize: 18 }} />
        )}
      </div>

      <div style={{ flex: 1, maxWidth: '80%' }}>
        <div style={{
          background: isGuide ? '#F0F7FF' : '#FFF8E1',
          borderRadius: isGuide ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          padding: '12px 16px',
          border: isGuide ? '1px solid #BAE0FF' : '1px solid #FFE58F',
        }}>
          <Text style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: isGuide ? '#1A1A1A' : '#5C3D00',
          }}>
            {text}
          </Text>
        </div>

        {isGuide && onReplay && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={onReplay}
            style={{ marginTop: 4, color: '#4DABF7', padding: '0 4px' }}
          >
            重播
          </Button>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/reader/DialogueBubble.tsx
git commit -m "feat: add DialogueBubble component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create GuideDialogue container component

**Files:**
- Create: `frontend/src/components/reader/GuideDialogue.tsx`

**Interfaces:**
- Consumes: `DialogueBubble`, `DialogueStartResponse`, `DialogueTurnRequest`, `DialogueTurnResponse`, `DialogueMessage` types, `planApi`, `ttsApi`, `useVoiceInput`
- Produces: `GuideDialogue` component — props: `dayId: number`, `onComplete: () => void`, `onSkip: () => void`

- [ ] **Step 1: Write GuideDialogue component**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Space, Spin, Tag, Typography } from 'antd'
import { AudioOutlined, AudioMutedOutlined, EditOutlined, ForwardOutlined } from '@ant-design/icons'
import DialogueBubble from './DialogueBubble'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { planApi, ttsApi } from '../../services/api'
import type { DialogueMessage } from '../../types'

const { Text } = Typography

interface Props {
  dayId: number
  onComplete: () => void
  onSkip: () => void
}

export default function GuideDialogue({ dayId, onComplete, onSkip }: Props) {
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [talkingPoints, setTalkingPoints] = useState<string[]>([])
  const [pointIndex, setPointIndex] = useState(0)
  const [roundInPoint, setRoundInPoint] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const { isListening, error: voiceError, start, stop, clearError } = useVoiceInput()
  const bottomRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Start dialogue on mount
  useEffect(() => {
    planApi.dialogueStart(dayId).then(({ data }) => {
      setTalkingPoints(data.talking_points)
      setMessages([{ role: 'guide', text: data.first_tts }])
      playTTS(data.first_tts)
      setLoading(false)
    }).catch((err) => {
      setError('启动对话失败: ' + (err?.message || '未知错误'))
      setLoading(false)
    })
  }, [dayId])

  const playTTS = useCallback(async (text: string) => {
    try {
      const { data } = await ttsApi.synthesize(text)
      const blob = new Blob([data], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      const audio = new Audio(url)
      audioRef.current = audio
      audio.play().catch(() => { /* autoplay blocked, user can tap replay */ })
    } catch {
      // TTS failed silently — text is still visible
    }
  }, [])

  const handleVoiceResult = useCallback(async (text: string) => {
    if (!text.trim()) return
    setProcessing(true)
    setError(null)

    const childMsg: DialogueMessage = { role: 'child', text }
    setMessages(prev => [...prev, childMsg])

    try {
      const { data } = await planApi.dialogueTurn(dayId, {
        point_index: pointIndex,
        round_in_point: roundInPoint,
        child_text: text,
        talking_points: talkingPoints,
      })

      const guideMsg: DialogueMessage = { role: 'guide', text: data.tts_text }
      setMessages(prev => [...prev, guideMsg])
      playTTS(data.tts_text)

      if (data.done) {
        setDone(true)
        setTimeout(onComplete, 2000)
      } else if (data.next_point) {
        setPointIndex(prev => prev + 1)
        setRoundInPoint(1)
      } else {
        setRoundInPoint(prev => prev + 1)
      }
    } catch (err: any) {
      setError('对话出错了: ' + (err?.message || '未知错误'))
    } finally {
      setProcessing(false)
    }
  }, [pointIndex, roundInPoint, talkingPoints, dayId, playTTS, onComplete])

  const handleStartRecording = () => {
    clearError()
    start(handleVoiceResult)
  }

  const handleStopRecording = () => {
    stop()
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="引导员正在准备……" />
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Text type="danger">{error}</Text>
        <br />
        <Button onClick={onSkip} type="primary" style={{ marginTop: 16, borderRadius: 12 }}>
          跳过对话，直接开始阅读
        </Button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 280px)',
      minHeight: 400,
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', marginBottom: 16,
        padding: '8px 0', borderBottom: '1px solid #F0F0F0',
      }}>
        <Tag color="blue" style={{ fontSize: 13, padding: '2px 12px' }}>
          对话导读中 · 第 {pointIndex + 1}/{talkingPoints.length} 个话题
        </Tag>
        {done && <Tag color="green" style={{ marginLeft: 8 }}>即将进入阅读</Tag>}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 4px',
        overscrollBehavior: 'contain',
      }}>
        {messages.map((msg, i) => (
          <DialogueBubble
            key={i}
            role={msg.role}
            text={msg.text}
            onReplay={msg.role === 'guide' ? () => playTTS(msg.text) : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <Text type="danger" style={{ fontSize: 12, textAlign: 'center', display: 'block', marginTop: 4 }}>
          {error}
        </Text>
      )}
      {voiceError && (
        <Text type="warning" style={{ fontSize: 12, textAlign: 'center', display: 'block', marginTop: 4 }}>
          {voiceError}
        </Text>
      )}

      {/* Input */}
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: '1px solid #F0F0F0',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
      }}>
        {processing ? (
          <Spin tip="引导员正在思考……" />
        ) : done ? (
          <Button type="primary" onClick={onComplete} style={{ borderRadius: 16 }}>
            开始阅读文章
          </Button>
        ) : (
          <Space size="middle">
            <Button
              type={isListening ? 'default' : 'primary'}
              shape="round"
              size="large"
              danger={isListening}
              icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={isListening ? handleStopRecording : handleStartRecording}
              style={{ minWidth: 160 }}
            >
              {isListening ? '点击停止' : '用声音回答'}
            </Button>

            <Button
              shape="round"
              size="large"
              icon={<EditOutlined />}
              disabled
              title="打字模式即将支持"
            >
              打字
            </Button>

            <Button
              type="text"
              icon={<ForwardOutlined />}
              onClick={onSkip}
            >
              跳过对话
            </Button>
          </Space>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/reader/GuideDialogue.tsx
git commit -m "feat: add GuideDialogue container component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Integrate GuideDialogue into ReadingSessionPage Stage 0

**Files:**
- Modify: `frontend/src/pages/ReadingSessionPage.tsx`

**Interfaces:**
- Consumes: `GuideDialogue` component

- [ ] **Step 1: Replace Stage 0 static card with GuideDialogue**

Replace Stage 0 block (lines 86-150, the `{step === 0 && lesson && (` block) with:

```tsx
{/* Stage 0: 导读 — 引导员语音对话 */}
{step === 0 && lesson && dayId && (
  <motion.div key="pre" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <Card style={{ borderRadius: 16, padding: '8px 4px' }}>
      <GuideDialogue
        dayId={Number(dayId)}
        onComplete={() => setStep(1)}
        onSkip={() => setStep(1)}
      />
    </Card>
  </motion.div>
)}
```

Add import at top:

```tsx
import GuideDialogue from '../components/reader/GuideDialogue'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReadingSessionPage.tsx
git commit -m "feat: replace static Stage 0 with voice dialogue guide

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start dev environment**

Run: `bash scripts/start-dev.sh`

- [ ] **Step 2: Verify backend endpoints**

Run: `curl -X POST http://localhost:8002/api/plan/days/1/dialogue/start -H "X-Student-ID: 1"`
Expected: JSON with `talking_points`, `first_tts`, `total_points`

Run: `curl -X POST http://localhost:8002/api/plan/days/1/dialogue/turn -H "X-Student-ID: 1" -H "Content-Type: application/json" -d '{"point_index":0,"round_in_point":1,"child_text":"我觉得小兔子可以找石头","talking_points":["测试话题"]}'`
Expected: JSON with `tts_text`, `feedback_type`, `next_point`, `done`

- [ ] **Step 3: Open browser and test the flow**

Navigate to `http://localhost:3002/plan`, select a plan day, start the reading session.
Expected: Stage 0 shows dialogue interface with guide's first TTS message.

- [ ] **Step 4: Test voice recording flow**

Click "用声音回答", speak, click stop.
Expected: STT transcription appears as child bubble, guide responds with next TTS.

- [ ] **Step 5: Test skip flow**

Click "跳过对话".
Expected: Immediately enters Stage 1 (reading).

- [ ] **Step 6: Test completion flow**

Answer all talking points until dialogue ends.
Expected: Auto-transitions to Stage 1.

- [ ] **Step 7: Commit if any fixes were made**
