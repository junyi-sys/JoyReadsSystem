from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import TheoryService

router = APIRouter(prefix="/api/theory", tags=["theory"])


class CreateTheoryBody(BaseModel):
    title: str
    content: str
    linked_curiosity_event_id: int | None = None
    linked_article_id: int | None = None


@router.get("")
def list_theories(
    limit: int = 20, offset: int = 0,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = TheoryService(db)
    return svc.list_theories(student_id, limit, offset)


@router.get("/{theory_id}")
def get_theory(
    theory_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = TheoryService(db)
    result = svc.get_theory(theory_id, student_id)
    if not result:
        raise HTTPException(status_code=404, detail="理论不存在")
    return result


@router.post("")
def create_theory(
    body: CreateTheoryBody,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = TheoryService(db)
    return svc.create_theory(
        student_id, body.title, body.content,
        linked_curiosity_event_id=body.linked_curiosity_event_id,
        linked_article_id=body.linked_article_id,
    )
