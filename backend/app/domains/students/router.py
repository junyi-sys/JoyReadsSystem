from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Student

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
            "avatar_url": s.avatar_url,
            "is_active": s.is_active,
        }
        for s in students
    ]
