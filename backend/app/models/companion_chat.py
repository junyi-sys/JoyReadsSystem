from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class CompanionChat(Base):
    __tablename__ = "companion_chat"
    __table_args__ = (
        Index("ix_companion_chat_student_article", "student_id", "article_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    article_id: Mapped[int] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, comment="child|companion")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="消息内容")
    emotion: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="情绪类型: boast|confused|conflict|ignorant|neutral")
    emotion_label: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="情绪中文标签")
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
