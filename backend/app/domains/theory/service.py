from sqlalchemy.orm import Session
from .repository import TheoryRepository


class TheoryService:
    def __init__(self, db: Session):
        self.repo = TheoryRepository(db)

    def list_theories(self, student_id: int, limit: int = 20, offset: int = 0) -> list[dict]:
        theories = self.repo.list_by_student(student_id, limit, offset)
        return [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "linked_curiosity_event_id": t.linked_curiosity_event_id,
                "linked_article_id": t.linked_article_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in theories
        ]

    def get_theory(self, theory_id: int, student_id: int) -> dict | None:
        t = self.repo.get_by_id(theory_id, student_id)
        if not t:
            return None
        return {
            "id": t.id,
            "title": t.title,
            "content": t.content,
            "linked_curiosity_event_id": t.linked_curiosity_event_id,
            "linked_article_id": t.linked_article_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }

    def create_theory(
        self, student_id: int, title: str, content: str,
        linked_curiosity_event_id: int | None = None,
        linked_article_id: int | None = None,
    ) -> dict:
        t = self.repo.create(
            student_id, title, content,
            linked_curiosity_event_id=linked_curiosity_event_id,
            linked_article_id=linked_article_id,
        )
        return {"id": t.id, "title": t.title, "content": t.content}
