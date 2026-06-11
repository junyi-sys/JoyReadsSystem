from sqlalchemy.orm import Session
from ...models import Theory


class TheoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_student(self, student_id: int, limit: int = 20, offset: int = 0) -> list[Theory]:
        return (
            self.db.query(Theory)
            .filter(Theory.student_id == student_id)
            .order_by(Theory.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_by_id(self, theory_id: int, student_id: int) -> Theory | None:
        return (
            self.db.query(Theory)
            .filter(Theory.id == theory_id, Theory.student_id == student_id)
            .first()
        )

    def create(
        self, student_id: int, title: str, content: str,
        linked_curiosity_event_id: int | None = None,
        linked_article_id: int | None = None,
    ) -> Theory:
        theory = Theory(
            student_id=student_id,
            title=title,
            content=content,
            linked_curiosity_event_id=linked_curiosity_event_id,
            linked_article_id=linked_article_id,
        )
        self.db.add(theory)
        self.db.commit()
        self.db.refresh(theory)
        return theory
