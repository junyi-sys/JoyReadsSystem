from sqlalchemy.orm import Session
from sqlalchemy import func
import hmac
from ...models import Student, ArticleReadStatus, Character, LevelConfig, StudentFeatureFlags, CuriositySeed


class ParentService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_students(self) -> list[dict]:
        from sqlalchemy import or_
        students = self.db.query(Student).filter(or_(Student.is_active == True, Student.is_active == None)).all()
        if not students:
            return []

        student_ids = [s.id for s in students]

        read_counts = dict(
            self.db.query(ArticleReadStatus.student_id, func.count(ArticleReadStatus.id))
            .filter(ArticleReadStatus.student_id.in_(student_ids), ArticleReadStatus.status == "read")
            .group_by(ArticleReadStatus.student_id).all()
        )
        ally_counts = dict(
            self.db.query(Character.student_id, func.count(Character.id))
            .filter(Character.student_id.in_(student_ids), Character.zone == "ally")
            .group_by(Character.student_id).all()
        )

        result = []
        for s in students:
            result.append({
                "id": s.id, "name": s.name, "age": s.age,
                "level": s.cognition_level, "articles_read": read_counts.get(s.id, 0),
                "ally_chars": ally_counts.get(s.id, 0),
                "last_activity": s.updated_at.isoformat() if s.updated_at else None,
                "is_active": s.is_active,
            })
        return result

    def get_student_detail(self, student_id: int) -> dict | None:
        s = self.db.query(Student).filter(Student.id == student_id).first()
        if not s:
            return None

        flags = self.db.query(StudentFeatureFlags).filter(
            StudentFeatureFlags.student_id == student_id
        ).first()

        configs = self.db.query(LevelConfig).filter(
            LevelConfig.student_id == student_id
        ).all()

        seeds = self.db.query(CuriositySeed).filter(
            CuriositySeed.student_id == student_id
        ).order_by(CuriositySeed.created_at.desc()).limit(10).all()

        return {
            "student": {"id": s.id, "name": s.name, "age": s.age,
                        "cognition_level": s.cognition_level, "is_active": s.is_active},
            "feature_flags": {
                "socratic_enabled": flags.socratic_enabled if flags else True,
                "seed_auto_grow": flags.seed_auto_grow if flags else True,
                "ai_review_enabled": flags.ai_review_enabled if flags else True,
                "reading_plan_enabled": flags.reading_plan_enabled if flags else True,
            },
            "level_configs": [{"level": c.level, "word_threshold": c.word_threshold,
                               "article_threshold": c.article_threshold} for c in configs],
            "seeds": [{"id": seed.id, "question_text": seed.question_text, "status": seed.status,
                       "created_at": seed.created_at.isoformat() if seed.created_at else None} for seed in seeds],
        }

    def verify_pin(self, student_id: int, pin: str) -> bool:
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student or not student.pin_code:
            return False
        return hmac.compare_digest(student.pin_code, pin)
