import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import PlanService

router = APIRouter(prefix="/api/plan", tags=["精读计划"])


class AnswerItem(BaseModel):
    question_type: str = Field(..., max_length=30, description="find_clue|infer_cause|connect_life|main_question")
    question: str = Field(..., max_length=500)
    child_answer: str = Field(..., max_length=500)
    is_correct: bool = True

class CompleteDayBody(BaseModel):
    answers: List[AnswerItem] = Field(..., min_length=1, max_length=10)


class DialogueTurnRequest(BaseModel):
    point_index: int = Field(..., ge=0)
    round_in_point: int = Field(..., ge=1, le=3)
    child_text: str = Field("", max_length=200)
    talking_points: list[str] = Field(..., min_length=1, max_length=10)


@router.post("/days/{day_id}/dialogue/start")
async def start_dialogue(day_id: int, student_id: int = Depends(get_current_student_id),
                         db: Session = Depends(get_db)):
    """Start the pre-reading dialogue. Returns talking points and first TTS text."""
    svc = PlanService(db)
    day = svc.repo.get_plan_day(day_id)
    if not day:
        raise HTTPException(status_code=404, detail="PlanDay not found")
    if not day.lesson_json:
        raise HTTPException(status_code=400, detail="No lesson plan for this day")

    try:
        lesson = json.loads(day.lesson_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson JSON")

    # Get student cognition level
    from ...models import Student
    student = db.query(Student).filter(Student.id == student_id).first()
    cognition = student.cognition_level if student else 0

    from .dialogue import DialogueEngine
    engine = DialogueEngine(lesson, cognition)
    points = await engine.generate_talking_points()

    first_tts = points[0] if points else "准备好了吗？我们来读一个有趣的故事！"

    # Record dialogue start as a ComprehensionRecord
    from ...models import ComprehensionRecord
    record = ComprehensionRecord(
        student_id=student_id,
        article_id=day.article_id,
        plan_day_id=day.id,
        focus="dialogue_start",
        question="导读对话开始",
        correct_answer="",
        child_answer=f"talking_points: {len(points)}",
    )
    db.add(record)
    db.commit()

    return {
        "talking_points": points,
        "first_tts": first_tts,
        "total_points": len(points),
    }


@router.post("/days/{day_id}/dialogue/turn")
async def dialogue_turn(day_id: int, body: DialogueTurnRequest,
                        student_id: int = Depends(get_current_student_id),
                        db: Session = Depends(get_db)):
    """Process a single dialogue turn. Returns guide's response."""
    svc = PlanService(db)
    day = svc.repo.get_plan_day(day_id)
    if not day:
        raise HTTPException(status_code=404, detail="PlanDay not found")
    if not day.lesson_json:
        raise HTTPException(status_code=400, detail="No lesson plan for this day")

    try:
        lesson = json.loads(day.lesson_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson JSON")

    from ...models import Student
    student = db.query(Student).filter(Student.id == student_id).first()
    cognition = student.cognition_level if student else 0

    from .dialogue import DialogueEngine
    engine = DialogueEngine(lesson, cognition)
    result = await engine.process_turn(
        body.point_index, body.round_in_point,
        body.child_text, body.talking_points,
    )

    # Record the dialogue turn
    from ...models import ComprehensionRecord
    current_point = body.talking_points[body.point_index] if body.point_index < len(body.talking_points) else ""
    record = ComprehensionRecord(
        student_id=student_id,
        article_id=day.article_id,
        plan_day_id=day.id,
        focus="dialogue_turn",
        question=current_point[:200],
        correct_answer="",
        child_answer=body.child_text[:200],
    )
    db.add(record)
    db.commit()

    return result


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
        return svc.complete_day(day_id, student_id, body.answers)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
