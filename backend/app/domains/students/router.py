from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Student
from ...config import settings as cfg
from .service import StudentService

router = APIRouter(prefix="/api/students", tags=["学生"])


@router.get("/")
def list_students(db: Session = Depends(get_db)):
    students = db.query(Student).filter(Student.is_active == True).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "age": s.age,
            "cognition_level": s.cognition_level,
            "cognition_label": cfg.COGNITION_LEVEL_LABELS.get(s.cognition_level, str(s.cognition_level)),
            "avatar_url": s.avatar_url,
            "is_active": s.is_active,
        }
        for s in students
    ]


@router.get("/{student_id}/level-progress")
def level_progress(student_id: int, db: Session = Depends(get_db)):
    svc = StudentService(db)
    return svc.get_level_progress(student_id)
