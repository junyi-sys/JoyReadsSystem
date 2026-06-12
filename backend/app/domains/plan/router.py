from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import PlanService

router = APIRouter(prefix="/api/plan", tags=["精读计划"])


class CompleteDayBody(BaseModel):
    child_answer: str = Field(..., max_length=500)
    is_correct: bool
    question: str = Field(..., max_length=500)
    correct_answer: str = Field(..., max_length=200)


@router.post("/create")
def create_plan(student_id: int = Depends(get_current_student_id),
                db: Session = Depends(get_db)):
    svc = PlanService(db)
    return svc.create_plan(student_id)


@router.get("/current")
def get_current_plan(student_id: int = Depends(get_current_student_id),
                     db: Session = Depends(get_db)):
    svc = PlanService(db)
    plan = svc.get_current_plan(student_id)
    if not plan:
        return None
    return plan


@router.post("/days/{day_id}/start")
def start_day(day_id: int, student_id: int = Depends(get_current_student_id),
              db: Session = Depends(get_db)):
    svc = PlanService(db)
    try:
        return svc.start_day(day_id, student_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/days/{day_id}/complete")
def complete_day(day_id: int, body: CompleteDayBody,
                 student_id: int = Depends(get_current_student_id),
                 db: Session = Depends(get_db)):
    svc = PlanService(db)
    try:
        return svc.complete_day(day_id, student_id, body.child_answer, body.is_correct,
                                body.question, body.correct_answer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
