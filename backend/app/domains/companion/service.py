import json
import logging
from sqlalchemy.orm import Session
from ...di import Container
from ...shared.emotions import build_emotion_detection_prompt, EMOTION_PROMPTS
from ...shared.async_utils import run_async

logger = logging.getLogger(__name__)


class CompanionService:
    def __init__(self, db: Session):
        self.db = db

    async def chat(
        self,
        student_id: int,
        message: str,
        article_id: int,
        article_context: str = "",
        main_question: str = "",
        chat_history: list[dict] | None = None,
    ) -> dict:
        llm = Container.llm()

        emotion_prompt = build_emotion_detection_prompt(message, article_context, main_question)
        emotion_result = await llm.generate_json(
            emotion_prompt,
            system="你是儿童情绪分析专家。只返回JSON。",
            temperature=0.3,
        )

        emotion = emotion_result.get("emotion", "neutral")
        emotion_label = emotion_result.get("emotion_label", "中性")
        confidence = emotion_result.get("confidence", 0.5)
        keyword = emotion_result.get("keyword", "")

        emotion_config = EMOTION_PROMPTS.get(emotion, EMOTION_PROMPTS["neutral"])

        history_text = ""
        if chat_history:
            history_text = "\n".join(
                f"{'孩子' if h['role'] == 'child' else '阅读伙伴'}：{h['content']}"
                for h in chat_history[-6:]
            )

        reply_prompt = f"""你是一个温暖的阅读伙伴（小猪形象），正在陪孩子读文章。

文章话题：{article_context}
精读主问题：{main_question}
孩子情绪：{emotion_label}（{emotion_config['strategy']}）
关键词：{keyword}

最近对话：
{history_text}

孩子刚才说："{message}"

请用{emotion_config['strategy']}的方式回应。要求：
1. 语气亲切，像朋友聊天
2. 回复简短（30-60字）
3. 引导孩子回到文章或主问题
4. 不要直接给答案，用提问引导"""

        reply_result = await llm.generate(
            reply_prompt,
            system="你是温暖的儿童阅读伙伴，用简单亲切的语言和孩子对话。",
            temperature=0.8,
            max_tokens=200,
        )

        return {
            "reply": reply_result.content.strip(),
            "emotion": emotion,
            "emotion_label": emotion_label,
            "confidence": confidence,
            "keyword": keyword,
        }