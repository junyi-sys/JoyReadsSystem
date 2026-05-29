from sqlalchemy.orm import Session
from app.models.advanced_concept import AdvancedConcept
from app.shared.ensure_student import ensure_student


class ConceptRepository:
    def get_by_student(self, db: Session, student_id: int) -> list[AdvancedConcept]:
        ensure_student(db, student_id)
        return (
            db.query(AdvancedConcept)
            .filter(AdvancedConcept.student_id == student_id)
            .order_by(AdvancedConcept.created_at.desc())
            .all()
        )

    def get_concepts_for_prompt(self, db: Session, student_id: int) -> list[str]:
        """Return flat list of concept strings for prompt injection."""
        rows = self.get_by_student(db, student_id)
        return [r.concept for r in rows]

    def create(
        self, db: Session, student_id: int, concept: str,
        source: str = "manual", article_id: int | None = None,
    ) -> AdvancedConcept:
        ensure_student(db, student_id)
        ac = AdvancedConcept(
            student_id=student_id, concept=concept,
            source=source, article_id=article_id,
        )
        db.add(ac)
        db.flush()
        return ac

    def delete(self, db: Session, concept_id: int, student_id: int) -> bool:
        ac = db.query(AdvancedConcept).filter(
            AdvancedConcept.id == concept_id,
            AdvancedConcept.student_id == student_id,
        ).first()
        if not ac:
            return False
        db.delete(ac)
        db.flush()
        return True
