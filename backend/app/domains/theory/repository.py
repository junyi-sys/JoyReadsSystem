from sqlalchemy.orm import Session
from app.models.theory import Theory
from app.shared.ensure_student import ensure_student


class TheoryRepository:
    def get_by_student(self, db: Session, student_id: int, limit: int = 20, offset: int = 0) -> list[Theory]:
        ensure_student(db, student_id)
        return (
            db.query(Theory)
            .filter(Theory.student_id == student_id)
            .order_by(Theory.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_by_id(self, db: Session, theory_id: int, student_id: int) -> Theory | None:
        return (
            db.query(Theory)
            .filter(Theory.id == theory_id, Theory.student_id == student_id)
            .first()
        )

    def get_by_curiosity_event(self, db: Session, event_id: int, student_id: int) -> list[Theory]:
        return (
            db.query(Theory)
            .filter(Theory.linked_curiosity_event_id == event_id, Theory.student_id == student_id)
            .order_by(Theory.created_at.desc())
            .all()
        )

    def create(
        self, db: Session, student_id: int, title: str, content: str,
        audio_url: str | None = None,
        linked_curiosity_event_id: int | None = None,
        linked_article_id: int | None = None,
    ) -> Theory:
        ensure_student(db, student_id)
        theory = Theory(
            student_id=student_id,
            title=title,
            content=content,
            audio_url=audio_url,
            linked_curiosity_event_id=linked_curiosity_event_id,
            linked_article_id=linked_article_id,
        )
        db.add(theory)
        db.flush()
        return theory

    def count(self, db: Session, student_id: int) -> int:
        return db.query(Theory).filter(Theory.student_id == student_id).count()
