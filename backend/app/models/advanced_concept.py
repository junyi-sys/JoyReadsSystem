from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class AdvancedConcept(Base, TimestampMixin):
    __tablename__ = "advanced_concept"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    concept: Mapped[str] = mapped_column(String(100), nullable=False, comment="高级概念/术语")
    source: Mapped[str] = mapped_column(String(20), default="manual", comment="manual|detected|voice")
    article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)
