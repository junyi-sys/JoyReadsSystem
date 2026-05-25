from sqlalchemy.orm import Session
from ...models import Student, Character
from ...models.reading import ArticleReadStatus
from ...config import settings as cfg


class StudentService:
    def __init__(self, db: Session):
        self.db = db

    def get_student(self, student_id: int) -> Student | None:
        return self.db.query(Student).filter(Student.id == student_id).first()

    def check_and_level_up(self, student_id: int) -> dict | None:
        student = self.get_student(student_id)
        if not student or student.cognition_level >= 6:
            return None

        next_level = student.cognition_level + 1
        threshold = cfg.LEVEL_THRESHOLDS.get(next_level)
        if not threshold:
            return None

        total_read = self.db.query(ArticleReadStatus).filter(
            ArticleReadStatus.student_id == student_id,
            ArticleReadStatus.status == "read",
        ).count()

        ally_count = self.db.query(Character).filter(
            Character.student_id == student_id,
            Character.zone == "ally",
        ).count()

        if total_read >= threshold["articles"] and ally_count >= threshold["chars"]:
            old_level = student.cognition_level
            student.cognition_level = next_level
            self.db.commit()
            return {
                "old_level": old_level,
                "new_level": next_level,
                "old_label": cfg.COGNITION_LEVEL_LABELS.get(old_level, str(old_level)),
                "new_label": cfg.COGNITION_LEVEL_LABELS.get(next_level, str(next_level)),
            }
        return None

    def get_level_progress(self, student_id: int) -> dict:
        student = self.get_student(student_id)
        if not student:
            return {}

        total_read = self.db.query(ArticleReadStatus).filter(
            ArticleReadStatus.student_id == student_id,
            ArticleReadStatus.status == "read",
        ).count()

        ally_count = self.db.query(Character).filter(
            Character.student_id == student_id,
            Character.zone == "ally",
        ).count()

        current = student.cognition_level
        next_level = min(current + 1, 6) if current < 6 else None
        threshold = cfg.LEVEL_THRESHOLDS.get(next_level) if next_level else None

        return {
            "current_level": current,
            "current_label": cfg.COGNITION_LEVEL_LABELS.get(current, str(current)),
            "next_level": next_level,
            "next_label": cfg.COGNITION_LEVEL_LABELS.get(next_level, str(next_level)) if next_level else None,
            "articles_read": total_read,
            "articles_needed": threshold["articles"] if threshold else 0,
            "ally_chars": ally_count,
            "chars_needed": threshold["chars"] if threshold else 0,
            "can_level_up": bool(
                threshold and total_read >= threshold["articles"] and ally_count >= threshold["chars"]
            ),
        }
