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
        from ...di import Container

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
        from ...di import Container

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
