import asyncio
import logging
from sqlalchemy.orm import Session
from ...models import Theory
from .repository import TheoryRepository
from ...di import Container

logger = logging.getLogger(__name__)


class TheoryService:
    def __init__(self, db: Session):
        self.repo = TheoryRepository(db)

    def list_theories(self, student_id: int, limit: int = 20, offset: int = 0) -> list[dict]:
        theories = self.repo.list_by_student(student_id, limit, offset)
        return [self._to_dict(t) for t in theories]

    def get_theory(self, theory_id: int, student_id: int) -> dict | None:
        t = self.repo.get_by_id(theory_id, student_id)
        return self._to_dict(t) if t else None

    def _to_dict(self, t: Theory) -> dict:
        return {
            "id": t.id, "title": t.title, "content": t.content,
            "transcript": t.transcript, "ai_summary": t.ai_summary,
            "ai_encouragement": t.ai_encouragement,
            "linked_curiosity_event_id": t.linked_curiosity_event_id,
            "linked_article_id": t.linked_article_id,
            "has_audio": t.audio_data is not None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }

    def create_with_audio(
        self, student_id: int, title: str, content: str | None,
        audio_data: bytes | None = None, transcript: str | None = None,
        linked_curiosity_event_id: int | None = None,
        linked_article_id: int | None = None,
    ) -> dict:
        t = self.repo.create_with_audio(
            student_id, title, content,
            audio_data=audio_data, transcript=transcript,
            linked_curiosity_event_id=linked_curiosity_event_id,
            linked_article_id=linked_article_id,
        )
        return {"id": t.id, "title": t.title, "has_audio": audio_data is not None}

    def trigger_ai_review(self, theory_id: int, student_age: int, topic: str = ""):
        """Best-effort async LLM review — don't block on failure."""
        theory = self.repo.get_any_by_id(theory_id)
        if not theory or not theory.transcript:
            return
        try:
            llm = Container.llm()
            prompt = (
                f"一个{student_age}岁孩子读了关于{topic}的文章后，录了这段话：\n"
                f"'{theory.transcript}'\n"
                f"（孩子可能表达不完整、有口水话，这是正常的）\n"
                f"请用鼓励的语气：\n"
                f"1. 提炼孩子想表达的主要意思（1-2句话）\n"
                f"2. 肯定孩子说得好的地方\n"
                f"3. 不批评、不纠错、不打分"
            )
            # asyncio.run is needed because this runs on a threading.Thread, not an async event loop
            result = asyncio.run(llm.generate(
                prompt,
                system="你是儿童教育鼓励师，语气温暖鼓励。",
                temperature=0.7, max_tokens=300,
            ))
            lines = result.content.strip().split('\n')
            ai_summary = lines[0] if lines else ""
            ai_encouragement = '\n'.join(lines[1:]) if len(lines) > 1 else ""
            self.repo.update_review(theory_id, ai_summary, ai_encouragement)
        except Exception:
            logger.warning("AI review failed for theory %d", theory_id, exc_info=True)

    def delete_theory(self, theory_id: int, student_id: int) -> bool:
        return self.repo.delete(theory_id, student_id)
