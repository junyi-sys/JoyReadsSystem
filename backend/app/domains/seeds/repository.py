from sqlalchemy.orm import Session
from ...models import CuriositySeed


class SeedRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_student(self, student_id: int, status: str | None = None) -> list[CuriositySeed]:
        q = self.db.query(CuriositySeed).filter(CuriositySeed.student_id == student_id)
        if status:
            q = q.filter(CuriositySeed.status == status)
        return q.order_by(CuriositySeed.created_at.desc()).all()

    def create(self, student_id: int, question_text: str, source: str = "curiosity_chat",
               source_article_id: int | None = None) -> CuriositySeed:
        seed = CuriositySeed(
            student_id=student_id, question_text=question_text,
            source=source, source_article_id=source_article_id,
        )
        self.db.add(seed)
        self.db.commit()
        self.db.refresh(seed)
        return seed

    def get_by_id(self, seed_id: int, student_id: int) -> CuriositySeed | None:
        return self.db.query(CuriositySeed).filter(
            CuriositySeed.id == seed_id, CuriositySeed.student_id == student_id
        ).first()

    def update_status(self, seed_id: int, status: str, converted_article_id: int | None = None):
        seed = self.db.query(CuriositySeed).filter(CuriositySeed.id == seed_id).first()
        if seed:
            seed.status = status
            if converted_article_id:
                seed.converted_article_id = converted_article_id
            self.db.commit()

    def delete(self, seed_id: int, student_id: int) -> bool:
        seed = self.get_by_id(seed_id, student_id)
        if seed:
            self.db.delete(seed)
            self.db.commit()
            return True
        return False

    def get_oldest_pending(self, student_id: int) -> CuriositySeed | None:
        return self.db.query(CuriositySeed).filter(
            CuriositySeed.student_id == student_id, CuriositySeed.status == "pending"
        ).order_by(CuriositySeed.created_at.asc()).first()
