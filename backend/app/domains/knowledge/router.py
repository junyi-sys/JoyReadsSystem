from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...database import get_db
from ...shared.middleware import get_current_student_id
from .service import KnowledgeService

router = APIRouter(prefix="/api/knowledge", tags=["知识图谱"])


@router.get("/graph")
def get_graph(student_id: int = Depends(get_current_student_id),
              db: Session = Depends(get_db)):
    svc = KnowledgeService(db)
    return svc.get_graph(student_id)


@router.get("/nodes/{concept}")
def get_concept(concept: str, student_id: int = Depends(get_current_student_id),
                db: Session = Depends(get_db)):
    svc = KnowledgeService(db)
    return svc.get_concept(student_id, concept)
