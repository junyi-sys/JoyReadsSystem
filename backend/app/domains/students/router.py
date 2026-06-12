from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Student
from ...config import settings as cfg
from ...shared.ensure_student import ensure_student
from .service import StudentService

router = APIRouter(prefix="/api/students", tags=["学生"])


class LevelConfigBody(BaseModel):
    level: int = Field(..., ge=1, le=6)
    word_threshold: int = Field(..., ge=0)
    article_threshold: int = Field(..., ge=0)


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


@router.get("/{student_id}/level")
def get_level(student_id: int, db: Session = Depends(get_db)):
    from ...models import Character, ArticleReadStatus, LevelConfig
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    ally_count = db.query(Character).filter(
        Character.student_id == student_id, Character.zone == "ally"
    ).count()
    read_count = db.query(ArticleReadStatus).filter(
        ArticleReadStatus.student_id == student_id, ArticleReadStatus.status == "read"
    ).count()
    cfg_ = db.query(LevelConfig).filter(
        LevelConfig.student_id == student_id, LevelConfig.level == student.cognition_level + 1
    ).first()
    word_threshold = cfg_.word_threshold if cfg_ else 100
    article_threshold = cfg_.article_threshold if cfg_ else 5
    next_level = student.cognition_level + 1 if student.cognition_level < 6 else None
    return {
        "current_level": student.cognition_level,
        "current_label": cfg.COGNITION_LEVEL_LABELS.get(student.cognition_level, "未知"),
        "next_level": next_level,
        "next_label": cfg.COGNITION_LEVEL_LABELS.get(next_level) if next_level else None,
        "ally_chars": ally_count,
        "chars_needed": word_threshold,
        "articles_read": read_count,
        "articles_needed": article_threshold,
        "can_level_up": bool(ally_count >= word_threshold and read_count >= article_threshold and student.cognition_level < 6),
    }


@router.put("/{student_id}/level-config")
def update_level_config(student_id: int, body: LevelConfigBody, db: Session = Depends(get_db)):
    from ...models import LevelConfig
    ensure_student(db, student_id)
    cfg_ = db.query(LevelConfig).filter(
        LevelConfig.student_id == student_id, LevelConfig.level == body.level
    ).first()
    if cfg_:
        cfg_.word_threshold = body.word_threshold
        cfg_.article_threshold = body.article_threshold
    else:
        cfg_ = LevelConfig(
            student_id=student_id, level=body.level,
            word_threshold=body.word_threshold,
            article_threshold=body.article_threshold,
        )
        db.add(cfg_)
    db.commit()
    return {"ok": True}


@router.get("/{student_id}/feature-flags")
def get_feature_flags(student_id: int, db: Session = Depends(get_db)):
    from ...models import StudentFeatureFlags
    flags = db.query(StudentFeatureFlags).filter(StudentFeatureFlags.student_id == student_id).first()
    if not flags:
        flags = StudentFeatureFlags(student_id=student_id)
        db.add(flags)
        db.commit()
        db.refresh(flags)
    return {
        "student_id": flags.student_id,
        "socratic_enabled": flags.socratic_enabled,
        "seed_auto_grow": flags.seed_auto_grow,
        "ai_review_enabled": flags.ai_review_enabled,
        "reading_plan_enabled": flags.reading_plan_enabled,
    }


@router.put("/{student_id}/feature-flags")
def update_feature_flags(student_id: int, body: dict, db: Session = Depends(get_db)):
    from ...models import StudentFeatureFlags
    flags = db.query(StudentFeatureFlags).filter(StudentFeatureFlags.student_id == student_id).first()
    if not flags:
        flags = StudentFeatureFlags(student_id=student_id)
        db.add(flags)
    for key in ("socratic_enabled", "seed_auto_grow", "ai_review_enabled", "reading_plan_enabled"):
        if key in body:
            setattr(flags, key, bool(body[key]))
    db.commit()
    return {"ok": True}
