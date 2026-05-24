from sqlalchemy.orm import Session
from ...models import CuriosityEvent
from ...shared.ensure_student import ensure_student


class CuriosityRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_events(self, student_id: int, answered: bool | None = None, limit: int = 50, offset: int = 0) -> list[CuriosityEvent]:
        q = self.db.query(CuriosityEvent).filter(
            CuriosityEvent.student_id == student_id,
        ).order_by(CuriosityEvent.created_at.desc())
        if answered is not None:
            q = q.filter(CuriosityEvent.is_answered == answered)
        return q.offset(offset).limit(limit).all()

    def get_by_id(self, event_id: int, student_id: int) -> CuriosityEvent | None:
        return self.db.query(CuriosityEvent).filter(
            CuriosityEvent.id == event_id,
            CuriosityEvent.student_id == student_id,
        ).first()

    def create_event(self, student_id: int, raw_text: str, mode: str = "one_shot") -> CuriosityEvent:
        ensure_student(self.db, student_id)
        event = CuriosityEvent(
            student_id=student_id, raw_text=raw_text, mode=mode,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def mark_answered(self, event_id: int, article_id: int):
        event = self.db.query(CuriosityEvent).filter(CuriosityEvent.id == event_id).first()
        if event:
            event.is_answered = True
            event.linked_article_id = article_id
            self.db.commit()
