from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...di import Container
from .service import CuriosityService

router = APIRouter(prefix="/api/curiosity", tags=["好奇心"])


class AskRequest(BaseModel):
    raw_text: str = Field(..., max_length=500)
    mode: str = Field(default="one_shot", max_length=20)
    tags: list[str] | None = Field(default=None, max_length=10)


class AskSeriesRequest(BaseModel):
    raw_text: str = Field(..., max_length=500)


class SeriesNextRequest(BaseModel):
    event_id: int
    want_next: bool
    user_question: str | None = Field(default=None, max_length=500)


class SocraticAnswerRequest(BaseModel):
    event_id: int
    child_response: str = Field(..., max_length=2000)


def _get_service(db: Session = Depends(get_db)) -> CuriosityService:
    return CuriosityService(db, Container.llm())


@router.get("/events")
def get_events(answered: bool | None = None, limit: int = 50, offset: int = 0,
               student_id: int = Depends(get_current_student_id),
               svc: CuriosityService = Depends(_get_service)):
    return svc.get_events(student_id, answered, limit, offset)


@router.post("/ask")
def ask(body: AskRequest, student_id: int = Depends(get_current_student_id),
        svc: CuriosityService = Depends(_get_service)):
    return svc.ask_one_shot(student_id, body.raw_text, body.tags)


@router.post("/ask-series")
def ask_series(body: AskSeriesRequest, student_id: int = Depends(get_current_student_id),
               svc: CuriosityService = Depends(_get_service)):
    return svc.start_series(student_id, body.raw_text)


@router.post("/series-next")
def series_next(body: SeriesNextRequest, student_id: int = Depends(get_current_student_id),
                svc: CuriosityService = Depends(_get_service)):
    return svc.series_next(body.event_id, student_id, body.want_next, body.user_question)


@router.post("/ask-socratic")
def ask_socratic(body: AskRequest, student_id: int = Depends(get_current_student_id),
                 svc: CuriosityService = Depends(_get_service)):
    if not body.raw_text.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")
    return svc.ask_socratic(student_id, body.raw_text.strip())


@router.post("/socratic-answer")
def submit_socratic_answer(body: SocraticAnswerRequest, student_id: int = Depends(get_current_student_id),
                           svc: CuriosityService = Depends(_get_service)):
    if not body.child_response.strip():
        raise HTTPException(status_code=400, detail="回答不能为空")
    return svc.submit_socratic_answer(body.event_id, student_id, body.child_response.strip())
