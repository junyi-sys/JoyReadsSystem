from fastapi import Request

STUDENT_HEADER = "X-Student-ID"


async def get_current_student_id(request: Request) -> int:
    """Extract student_id from request header. Validates existence; falls back to the first active student."""
    value = request.headers.get(STUDENT_HEADER, "1")
    try:
        requested_id = int(value)
    except ValueError:
        requested_id = 1

    from ..database import SessionLocal
    from ..models import Student
    db = SessionLocal()
    try:
        student = db.query(Student).filter(
            Student.id == requested_id, Student.is_active == True
        ).first()
        if student:
            return student.id
        # fallback: pick the first active student
        first = db.query(Student).filter(Student.is_active == True).first()
        return first.id if first else 1
    finally:
        db.close()
