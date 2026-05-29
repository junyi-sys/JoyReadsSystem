from sqlalchemy.orm import Session
from .repository import TheoryRepository


class TheoryService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TheoryRepository()

    def list_theories(self, student_id: int, limit: int = 20, offset: int = 0):
        theories = self.repo.get_by_student(self.db, student_id, limit, offset)
        total = self.repo.count(self.db, student_id)
        return {
            "items": [
                {
                    "id": t.id,
                    "title": t.title,
                    "content": t.content,
                    "audio_url": t.audio_url,
                    "linked_curiosity_event_id": t.linked_curiosity_event_id,
                    "linked_article_id": t.linked_article_id,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in theories
            ],
            "total": total,
        }

    def get_theory(self, theory_id: int, student_id: int):
        theory = self.repo.get_by_id(self.db, theory_id, student_id)
        if not theory:
            return None
        return {
            "id": theory.id,
            "title": theory.title,
            "content": theory.content,
            "audio_url": theory.audio_url,
            "linked_curiosity_event_id": theory.linked_curiosity_event_id,
            "linked_article_id": theory.linked_article_id,
            "created_at": theory.created_at.isoformat() if theory.created_at else None,
        }

    def create_theory(
        self, student_id: int, title: str, content: str,
        audio_url: str | None = None,
        linked_curiosity_event_id: int | None = None,
        linked_article_id: int | None = None,
    ):
        theory = self.repo.create(
            self.db, student_id, title, content,
            audio_url=audio_url,
            linked_curiosity_event_id=linked_curiosity_event_id,
            linked_article_id=linked_article_id,
        )
        self.db.commit()
        return {
            "id": theory.id,
            "title": theory.title,
            "content": theory.content,
            "created_at": theory.created_at.isoformat() if theory.created_at else None,
        }
