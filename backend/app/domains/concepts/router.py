from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import ConceptService

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


class AddConceptBody(BaseModel):
    concept: str
    source: str = "manual"


@router.get("")
def list_concepts(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = ConceptService(db)
    return svc.list_concepts(student_id)


@router.post("")
def add_concept(
    body: AddConceptBody,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = ConceptService(db)
    return svc.add_concept(student_id, body.concept, body.source)


@router.delete("/{concept_id}")
def remove_concept(
    concept_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = ConceptService(db)
    return svc.remove_concept(concept_id, student_id)
