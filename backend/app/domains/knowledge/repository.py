from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ...models import KnowledgeNode
from ...database import safe_commit


class KnowledgeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_nodes(self, student_id: int) -> list[KnowledgeNode]:
        return self.db.query(KnowledgeNode).filter(
            KnowledgeNode.student_id == student_id
        ).order_by(KnowledgeNode.depth.desc()).all()

    def get_node(self, student_id: int, concept: str) -> KnowledgeNode | None:
        return self.db.query(KnowledgeNode).filter(
            KnowledgeNode.student_id == student_id,
            KnowledgeNode.concept == concept,
        ).first()

    def upsert_node(self, student_id: int, concept: str, depth: int = 1,
                    source: str = "reading", evidence: str | None = None) -> KnowledgeNode:
        now = datetime.now()
        node = self.get_node(student_id, concept)
        if node:
            node.depth = min(4, max(node.depth, depth))
            node.updated_at = now
            if evidence:
                node.evidence = evidence
        else:
            node = KnowledgeNode(
                student_id=student_id, concept=concept, depth=depth,
                first_exposed_at=now, created_at=now, updated_at=now,
                source=source, evidence=evidence,
            )
            self.db.add(node)
        safe_commit(self.db)
        self.db.refresh(node)
        return node

    def apply_decay(self, student_id: int):
        cutoff = datetime.now() - timedelta(days=90)
        stale = self.db.query(KnowledgeNode).filter(
            KnowledgeNode.student_id == student_id,
            KnowledgeNode.updated_at < cutoff,
            KnowledgeNode.depth > 0,
        ).all()
        for node in stale:
            node.depth = max(0, node.depth - 1)
        if stale:
            safe_commit(self.db)
        return len(stale)
