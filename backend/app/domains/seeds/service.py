import re
import asyncio
from sqlalchemy.orm import Session
from .repository import SeedRepository
from ...di import Container

SEED_PATTERN = re.compile(r'为什么|怎么|会不会|是什么')


class SeedService:
    def __init__(self, db: Session):
        self.repo = SeedRepository(db)

    def list_seeds(self, student_id: int, status: str | None = None) -> list[dict]:
        seeds = self.repo.list_by_student(student_id, status)
        return [{
            "id": s.id, "question_text": s.question_text, "source": s.source,
            "status": s.status, "converted_article_id": s.converted_article_id,
            "created_at": s.created_at.isoformat(),
        } for s in seeds]

    def collect_if_seed(self, student_id: int, question: str) -> bool:
        """Auto-collect if question contains seed keywords. Returns True if collected."""
        if SEED_PATTERN.search(question):
            self.repo.create(student_id, question, source="curiosity_chat")
            return True
        return False

    def grow_seed(self, seed_id: int, student_id: int) -> dict | None:
        seed = self.repo.get_by_id(seed_id, student_id)
        if not seed or seed.status != "pending":
            return None
        self.repo.update_status(seed_id, "growing")
        try:
            llm = Container.llm()
            result = asyncio.run(llm.generate(
                f"孩子问了一个问题：'{seed.question_text}'。请用300-500字回答，语言适合小学生。",
                system="你是儿童科普作家，用生动有趣的语言解释科学问题。",
                temperature=0.7, max_tokens=800,
            ))
            from ...models import DailyArticle
            from datetime import date
            article = DailyArticle(
                student_id=student_id,
                record_date=date.today(),
                topic=f"好奇问答：{seed.question_text[:30]}",
                content=result.content,
                character_count=len(result.content),
                source="ai",
                category="answer",
            )
            self.repo.db.add(article)
            self.repo.db.commit()
            self.repo.db.refresh(article)
            self.repo.update_status(seed_id, "converted", converted_article_id=article.id)
            return {"article_id": article.id, "topic": article.topic}
        except Exception:
            self.repo.update_status(seed_id, "pending")
            raise

    def auto_grow_weekly(self, student_id: int) -> dict:
        seed = self.repo.get_oldest_pending(student_id)
        if not seed:
            return {"grown": False, "reason": "no pending seeds"}
        result = self.grow_seed(seed.id, student_id)
        return {"grown": True, "seed_id": seed.id, "article": result}
