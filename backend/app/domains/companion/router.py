from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import logging
from datetime import datetime
from ...database import get_db
from ...shared.middleware import get_current_student_id
from .service import CompanionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companion", tags=["陪读伙伴"])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(child|companion)$")
    content: str = Field(..., max_length=1000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, description="孩子说的话")
    article_id: int = Field(..., description="当前文章ID")
    article_context: str = Field("", max_length=200, description="文章话题/摘要")
    main_question: str = Field("", max_length=500, description="精读主问题")
    chat_history: list[ChatMessage] = Field(default_factory=list, max_length=50, description="最近对话历史")


class ChatResponse(BaseModel):
    reply: str
    emotion: str
    emotion_label: str
    confidence: float
    keyword: str


@router.post("/chat", response_model=ChatResponse)
async def companion_chat(
    body: ChatRequest,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    svc = CompanionService(db)
    result = await svc.chat(
        student_id=student_id,
        message=body.message,
        article_id=body.article_id,
        article_context=body.article_context,
        main_question=body.main_question,
        chat_history=[{"role": m.role, "content": m.content} for m in body.chat_history],
    )

    try:
        from ...models import CompanionChat
        now = datetime.now()
        db.add(CompanionChat(
            student_id=student_id, article_id=body.article_id,
            role="child", content=body.message,
            created_at=now,
        ))
        db.add(CompanionChat(
            student_id=student_id, article_id=body.article_id,
            role="companion", content=result["reply"],
            emotion=result["emotion"], emotion_label=result["emotion_label"],
            created_at=now,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save companion chat: {e}")

    return result


@router.get("/history/{article_id}")
def get_chat_history(
    article_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    from ...models import CompanionChat
    rows = db.query(CompanionChat).filter(
        CompanionChat.student_id == student_id,
        CompanionChat.article_id == article_id,
    ).order_by(CompanionChat.created_at).all()
    return [{
        "role": r.role,
        "content": r.content,
        "emotion": r.emotion,
        "emotion_label": r.emotion_label,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]