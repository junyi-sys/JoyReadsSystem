from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...di import Container
from .service import ArticleService

router = APIRouter(prefix="/api/articles", tags=["文章"])


# ===== Request Schemas =====

class GenerateRequest(BaseModel):
    topic: str
    characters: list[str] = []
    min_chars: int = 100
    max_chars: int = 350
    category: str = "daily"


class ReviseRequest(BaseModel):
    suggestions: str


class ReadStatusRequest(BaseModel):
    status: str  # 'reading' | 'read'
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
    try:
        return await svc.generate(student_id, body.topic, body.characters, body.min_chars, body.max_chars, body.category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI生成失败: {str(e)}")


@router.get("/{article_id}")
def get_article(article_id: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_article(article_id, student_id)


@router.post("/{article_id}/revise")
def revise_article(article_id: int, body: ReviseRequest, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    article = svc.get_article(article_id, student_id)
    try:
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修改失败: {str(e)}")


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
        svc.on_article_read(article_id, student_id)

    return {"id": record.id, "status": record.status}


# ===== Series Endpoints =====

@router.get("/series/{series_id}")
def get_series(series_id: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_series(series_id, student_id)


@router.get("/series/{series_id}/chapters/{chapter_number}")
def get_series_chapter(series_id: int, chapter_number: int, student_id: int = Depends(get_current_student_id), svc: ArticleService = Depends(_get_service)):
    return svc.get_series_chapter(series_id, chapter_number, student_id)
