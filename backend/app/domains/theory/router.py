from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import TheoryService

router = APIRouter(prefix="/api/theory", tags=["theory"])


class CreateTheoryBody(BaseModel):
    title: str = Field(..., max_length=200)
    content: str = Field(default="", max_length=5000)
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


@router.get("/{theory_id}/audio")
def get_theory_audio(theory_id: int, db: Session = Depends(get_db)):
    from ...models import Theory
    theory = db.query(Theory).filter(Theory.id == theory_id).first()
    if not theory or not theory.audio_data:
        raise HTTPException(status_code=404)
    return Response(content=theory.audio_data, media_type="audio/webm")


@router.post("")
async def create_theory(
    title: str = Form(...),
    content: str = Form(""),
    linked_curiosity_event_id: int | None = Form(None),
    linked_article_id: int | None = Form(None),
    audio: UploadFile | None = File(None),
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = TheoryService(db)
    audio_bytes = await audio.read() if audio else None
    transcript = None
    if audio_bytes:
        from ...domains.stt.service import STTService
        stt_svc = STTService()
        transcript = stt_svc.transcribe_bytes(audio_bytes, audio.filename or "recording.webm")

    result = svc.create_with_audio(
        student_id, title, content or None,
        audio_data=audio_bytes, transcript=transcript,
        linked_curiosity_event_id=linked_curiosity_event_id,
        linked_article_id=linked_article_id,
    )

    if transcript:
        import threading
        from ...models import Student
        student = db.query(Student).filter(Student.id == student_id).first()
        t = threading.Thread(
            target=svc.trigger_ai_review,
            args=(result["id"], student.age if student else 5, title),
        )
        t.start()

    return result


@router.delete("/{theory_id}")
def delete_theory(theory_id: int, student_id: int = Depends(get_current_student_id), db: Session = Depends(get_db)):
    svc = TheoryService(db)
    ok = svc.delete_theory(theory_id, student_id)
    if not ok:
        raise HTTPException(status_code=404, detail="理论不存在")
    return {"ok": True}
