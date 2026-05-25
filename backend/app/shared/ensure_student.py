from sqlalchemy.orm import Session
from ..models import Student


def ensure_student(db: Session, student_id: int) -> int:
    """Return a valid student_id, creating a default student if it doesn't exist."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if student:
        return student.id
    new_student = Student(id=student_id, name=f"学生{student_id}", age=5, cognition_level=0)
    db.add(new_student)
    db.flush()
    return new_student.id
