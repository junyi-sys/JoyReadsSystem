from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...di import Container
from .service import ArticleService

router = APIRouter(prefix="/api/articles", tags=["文章"])


# ===== Request Schemas =====

class GenerateRequest(BaseModel):
    topic: str = Field(..., max_length=200)
    summary: str = Field(default="", max_length=500)
    characters: list[str] = Field(default=[], max_length=50)
    min_chars: int = 100
    max_chars: int = 350
    category: str = Field(default="daily", max_length=50)
    density: int | None = None       # 每百字新字数，None=系统自动
    reinforce: int | None = None     # 每百字复习字数，None=系统自动


class ArticleParamsRequest(BaseModel):
    """Request to compute recommended article parameters from zone stats."""
    override: dict = {}  # optional: {"min_chars", "max_chars", "density", "reinforce"}


class ReviseRequest(BaseModel):
    suggestions: str = Field(..., max_length=1000)


class ReadStatusRequest(BaseModel):
    status: str = Field(..., max_length=20)  # 'reading' | 'read'
    read_count: int = 0
    total_count: int = 0


def _get_service(db: Session = Depends(get_db)) -> ArticleService:
    return ArticleService(db, Container.llm())


# ===== Article Endpoints =====

@router.get("/today")
def get_today(student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    article = svc.get_today(student_id)
    if not article:
        return None
    return article


@router.get("/history")
def get_history(limit: int = 50, offset: int = 0, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_history(student_id, limit, offset)


@router.post("/generate")
async def generate_article(body: GenerateRequest, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return await svc.generate(
        student_id, body.topic, body.summary, body.characters,
        body.min_chars, body.max_chars, body.category,
        density=body.density, reinforce=body.reinforce,
    )


@router.post("/compute-params")
def compute_article_params(body: ArticleParamsRequest, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    """Compute recommended article parameters based on student's zone stats."""
    return svc.calculate_article_params(student_id, body.override or {})


# ===== Reading Record (must be before /{article_id}) =====

@router.get("/{article_id}/reading-record")
def get_reading_record(article_id: int, student_id: int = Depends(get_current_student_id), db: Session = Depends(get_db)):
    import json
    from ...models import PlanDay, ComprehensionRecord

    plan_day = db.query(PlanDay).filter(PlanDay.article_id == article_id).first()

    lesson = None
    main_question = None
    if plan_day and plan_day.guide_text:
        try:
            data = json.loads(plan_day.guide_text)
            if data.get("version") == "v2" and "lesson" in data:
                lesson = data["lesson"]
                main_question = lesson.get("main_question")
            elif data.get("source") == "curiosity_seed":
                main_question = data.get("seed_question")
        except (json.JSONDecodeError, TypeError):
            pass

    records = db.query(ComprehensionRecord).filter(
        ComprehensionRecord.article_id == article_id,
        ComprehensionRecord.student_id == student_id,
    ).order_by(ComprehensionRecord.created_at.asc()).all()

    answers = []
    for r in records:
        hint = None
        if lesson:
            for sq in lesson.get("sub_questions", []):
                if sq.get("question") == r.question:
                    hint = sq.get("answer_hint")
                    break
        answers.append({
            "question_type": r.focus,
            "question": r.question,
            "child_answer": r.child_answer,
            "answer_hint": hint,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "article_id": article_id,
        "main_question": main_question,
        "lesson": lesson,
        "answers": answers,
        "has_record": bool(lesson or answers),
    }


@router.get("/{article_id}")
def get_article(article_id: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_article(article_id, student_id)


@router.post("/{article_id}/revise")
def revise_article(article_id: int, body: ReviseRequest, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    article = svc.get_article(article_id, student_id)
    import asyncio
    result = asyncio.run(Container.llm().generate(
        f"根据以下建议修改这篇文章:\n\n原文:\n{article['content']}\n\n修改建议:\n{body.suggestions}",
        system="你是儿童教育编辑。修改文章使其更适合儿童阅读。直接输出修改后的全文。",
        temperature=0.5, max_tokens=1500,
    ))
    from ...models import DailyArticle
    from ...database import SessionLocal
    db = SessionLocal()
    try:
        a = db.query(DailyArticle).filter(DailyArticle.id == article_id).first()
        if a:
            a.content = result.content
            a.character_count = len(result.content)
            db.commit()
    finally:
        db.close()
    return svc.get_article(article_id, student_id)


@router.delete("/{article_id}")
def delete_article(article_id: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    ok = svc.delete(article_id, student_id)
    return {"ok": ok}


@router.post("/{article_id}/read-status")
def update_read_status(article_id: int, body: ReadStatusRequest, student_id: int = Depends(get_current_student_id), db: Session = Depends(get_db)):
    from ...models import ArticleReadStatus
    from datetime import datetime
    record = db.query(ArticleReadStatus).filter(
        ArticleReadStatus.article_id == article_id,
        ArticleReadStatus.student_id == student_id,
    ).first()
    if not record:
        record = ArticleReadStatus(article_id=article_id, student_id=student_id)
        db.add(record)
    is_newly_read = (record.status != "read" and body.status == "read")
    record.status = body.status
    record.read_paragraph_count = body.read_count
    if body.total_count:
        record.total_paragraph_count = body.total_count
    if body.status == "reading" and not record.started_at:
        record.started_at = datetime.now()
    if body.status == "read":
        record.finished_at = datetime.now()
    db.commit()
    db.refresh(record)

    # Trigger auto-promotion engine on first read
    if is_newly_read:
        svc = ArticleService(db, Container.llm())
        result = svc.on_article_read(article_id, student_id)
    else:
        result = None

    resp = {"id": record.id, "status": record.status}
    if result and result.get("level_up"):
        resp["level_up"] = result["level_up"]
    return resp


# ===== Series Endpoints =====

@router.get("/series/{series_id}")
def get_series(series_id: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_series(series_id, student_id)


@router.get("/series/{series_id}/chapters/{chapter_number}")
def get_series_chapter(series_id: int, chapter_number: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_series_chapter(series_id, chapter_number, student_id)
