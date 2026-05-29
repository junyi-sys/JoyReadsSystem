from sqlalchemy.orm import Session
from .repository import ConceptRepository


class ConceptService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ConceptRepository()

    def list_concepts(self, student_id: int):
        concepts = self.repo.get_by_student(self.db, student_id)
        return [
            {
                "id": c.id, "concept": c.concept, "source": c.source,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in concepts
        ]

    def add_concept(self, student_id: int, concept: str, source: str = "manual"):
        c = self.repo.create(self.db, student_id, concept, source=source)
        self.db.commit()
        return {"id": c.id, "concept": c.concept, "source": c.source}

    def remove_concept(self, concept_id: int, student_id: int):
        ok = self.repo.delete(self.db, concept_id, student_id)
        self.db.commit()
        return {"deleted": ok}

    def get_concept_context(self, student_id: int) -> str:
        """Build a prompt-ready string from the student's advanced concepts."""
        concepts = self.repo.get_concepts_for_prompt(self.db, student_id)
        if not concepts:
            return ""
        return "、".join(concepts)
