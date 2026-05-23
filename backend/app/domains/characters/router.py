from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...shared.middleware import get_current_student_id
from .service import CharacterService

router = APIRouter(prefix="/api/characters", tags=["字库"])


class AddCharacterRequest(BaseModel):
    character: str
    zone: str  # target | scout | ally | lost


class MoveCharacterRequest(BaseModel):
    character: str
    from_zone: str
    to_zone: str


class InteractionRequest(BaseModel):
    character: str
    article_id: int | None = None


def _get_service(db: Session = Depends(get_db)) -> CharacterService:
    return CharacterService(db)


@router.get("/stats")
def get_stats(
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    return svc.get_stats(student_id)


@router.get("/zone/{zone}")
def get_zone(
    zone: str,
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    try:
        return svc.get_zone(zone, student_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/add")
def add_character(
    body: AddCharacterRequest,
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    try:
        svc.add_character(body.zone, student_id, body.character)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/move")
def move_character(
    body: MoveCharacterRequest,
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    try:
        svc.move_character(body.character, body.from_zone, body.to_zone, student_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/interaction")
def record_interaction(
    body: InteractionRequest,
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    """Record a character tap event from the article reader."""
    try:
        svc.record_interaction(body.character, student_id, body.article_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/zone-context")
def get_zone_context(
    student_id: int = Depends(get_current_student_id),
    svc: CharacterService = Depends(_get_service),
):
    """Get zone context for article generation prompt."""
    return svc.get_zone_context(student_id)
