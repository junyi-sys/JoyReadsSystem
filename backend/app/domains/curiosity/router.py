from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...di import Container
from .service import CuriosityService

router = APIRouter(prefix="/api/curiosity", tags=["好奇心"])


class AskRequest(BaseModel):
    raw_text: str
    mode: str = "one_shot"
    tags: list[str] | None = None


class AskSeriesRequest(BaseModel):
    raw_text: str


class SeriesNextRequest(BaseModel):
    event_id: int
    want_next: bool
    user_question: str | None = None


class SocraticRespondRequest(BaseModel):
    event_id: int
    child_response: str


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
    try:
        return svc.ask_one_shot(student_id, body.raw_text, body.tags)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI生成失败: {str(e)}")


@router.post("/ask-series")
def ask_series(body: AskSeriesRequest, student_id: int = Depends(get_current_student_id),
               svc: CuriosityService = Depends(_get_service)):
    try:
        return svc.start_series(student_id, body.raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"系列启动失败: {str(e)}")


@router.post("/ask-socratic")
def ask_socratic(body: AskRequest, student_id: int = Depends(get_current_student_id),
                 svc: CuriosityService = Depends(_get_service)):
    """苏格拉底模式：AI不直接回答，而是反问一个引导性问题"""
    try:
        return svc.ask_socratic(student_id, body.raw_text, body.tags)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"追问生成失败: {str(e)}")


@router.post("/socratic-respond")
def socratic_respond(body: SocraticRespondRequest,
                     student_id: int = Depends(get_current_student_id),
                     svc: CuriosityService = Depends(_get_service)):
    """孩子回答了AI的反问后，AI生成融入孩子想法的回答"""
    try:
        return svc.socratic_respond(body.event_id, student_id, body.child_response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"回答生成失败: {str(e)}")


@router.post("/series-next")
def series_next(body: SeriesNextRequest, student_id: int = Depends(get_current_student_id),
                svc: CuriosityService = Depends(_get_service)):
    try:
        return svc.series_next(body.event_id, student_id, body.want_next, body.user_question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")
