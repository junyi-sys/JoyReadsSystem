from sqlalchemy.orm import Session
from .repository import KnowledgeRepository


class KnowledgeService:
    def __init__(self, db: Session):
        self.repo = KnowledgeRepository(db)

    def get_graph(self, student_id: int) -> list[dict]:
        nodes = self.repo.get_all_nodes(student_id)
        return [
            {
                "id": n.id, "concept": n.concept, "depth": n.depth,
                "source": n.source, "evidence": n.evidence,
                "first_exposed_at": n.first_exposed_at.isoformat() if n.first_exposed_at else None,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in nodes
        ]

    def get_concept(self, student_id: int, concept: str) -> dict | None:
        n = self.repo.get_node(student_id, concept)
        if not n:
            return None
        return {
            "id": n.id, "concept": n.concept, "depth": n.depth,
            "source": n.source, "evidence": n.evidence,
            "first_exposed_at": n.first_exposed_at.isoformat() if n.first_exposed_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }

    def get_context_for_article(self, student_id: int) -> str:
        nodes = self.repo.get_all_nodes(student_id)
        if not nodes:
            return ""
        mastered = [n.concept for n in nodes if n.depth >= 3]
        building = [n.concept for n in nodes if n.depth == 2]
        new_exposed = [n.concept for n in nodes if n.depth == 1]
        parts = []
        if mastered:
            parts.append(f"已掌握概念（放心用）：{'、'.join(mastered)}")
        if building:
            parts.append(f"学习中概念（多重复）：{'、'.join(building)}")
        if new_exposed:
            parts.append(f"新接触概念（可提及）：{'、'.join(new_exposed)}")
        return "；".join(parts)
