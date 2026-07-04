from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ...database import get_db
from .service import ParentService

router = APIRouter(prefix="/api/parent", tags=["家长后台"])


class VerifyPinBody(BaseModel):
    student_id: int
    pin: str


@router.get("/students")
def get_all_students(db: Session = Depends(get_db)):
    svc = ParentService(db)
    return svc.get_all_students()


@router.get("/students/{student_id}/detail")
def get_student_detail(student_id: int, db: Session = Depends(get_db)):
    svc = ParentService(db)
    result = svc.get_student_detail(student_id)
    if not result:
        raise HTTPException(status_code=404)
    return result


@router.post("/verify-pin")
def verify_pin(body: VerifyPinBody, db: Session = Depends(get_db)):
    svc = ParentService(db)
    ok = svc.verify_pin(body.student_id, body.pin)
    return {"ok": ok}
